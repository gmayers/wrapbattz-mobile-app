# IAP Subscriptions — Backend Implementation Plan (Handoff)

**Audience:** Backend team (`api.tooltraq.com` repo — separate from this app repo).
**Goal:** Implement the server side of the IAP subscriptions contract so the mobile app's purchase, restore, and webhook flows actually function.
**Spec:** [docs/superpowers/specs/2026-05-12-iap-subscriptions-design.md](../specs/2026-05-12-iap-subscriptions-design.md) (in this repo)
**Mobile plan (sibling):** [docs/superpowers/plans/2026-05-12-iap-subscriptions-mobile.md](2026-05-12-iap-subscriptions-mobile.md)

This is a **handoff plan**, not an implementation plan I (the mobile-side worker) can execute. The backend lives in a different codebase and likely a different language/framework. Tasks below are described in terms of endpoints + behavior + libraries. Map them to your stack's conventions.

---

## What the mobile app already expects

The mobile app ships with the following hard contract (already merged on this repo):

### `GET /api/v1/billing/catalog`

Returns active subscription tiers. Server-driven config — adding/removing tiers doesn't require an app update.

```json
{
  "items": [
    {
      "tier_id": "pro_monthly",
      "name": "Pro",
      "description": "For growing teams",
      "features": ["Up to 50 assets", "All features", "Email support"],
      "asset_cap": 50,
      "duration": "monthly",
      "ios_product_id": "com.tooltraq.sub.pro.monthly",
      "android_product_id": "tooltraq_sub_pro_monthly",
      "stripe_price_id": "price_xxx",
      "sort_order": 10
    }
  ]
}
```

Filter to `is_active=true`. Hide synthetic tiers like `legacy_metered` from this endpoint.

### `GET /api/v1/billing/subscription`

Returns the caller's org's authoritative subscription state. Single source of truth for the mobile app.

```json
{
  "source": "stripe" | "apple_iap" | "google_iap" | null,
  "tier_id": "pro_monthly" | null,
  "status": "active" | "in_grace_period" | "expired" | "cancelled" | "refunded" | "pending",
  "current_period_end": "2026-06-12T00:00:00Z",
  "cancel_at_period_end": false,
  "purchasing_user_id": 123,
  "managed_in": "app_store" | "play_store" | "stripe_portal" | null
}
```

When no subscription: return all-null fields. The mobile app handles this gracefully.

### `POST /api/v1/billing/iap/verify`

Body:
```json
{
  "platform": "ios" | "android",
  "product_id": "com.tooltraq.sub.pro.monthly",
  "transaction_id": "2000000123456789",
  "original_transaction_id": "2000000123456789",
  "receipt": "<base64-encoded-receipt or unified-receipt>",
  "purchase_token": "..."
}
```

Behavior:
1. Validate receipt with Apple App Store Server API (try production endpoint first, retry against sandbox on `21007`) OR Google Play Developer API (`purchases.subscriptionsv2.get`).
2. Check the org has no other active subscription. If so → `409 { "code": "subscription_exists" }`.
3. Record the receipt in `iap_receipts`, dedupe on `(platform, transaction_id)`.
4. Upsert `org_subscriptions` with the new state.
5. Return the updated subscription state (same shape as `GET /billing/subscription`).

Error codes the mobile expects to see (in the error response body's `code` field — match your API's existing error shape):
- `invalid_receipt` (400)
- `unknown_product` (400) — `product_id` doesn't match any tier
- `subscription_exists` (409)
- `receipt_already_consumed_by_other_org` (409)
- `store_unavailable` (502) — Apple/Google API down; mobile will retry from its queue

### `POST /api/v1/billing/iap/restore`

Body:
```json
{
  "platform": "ios" | "android",
  "receipts": [
    { "transaction_id": "...", "receipt": "...", "product_id": "..." }
  ]
}
```

Behavior:
- Re-validate each receipt with Apple/Google.
- Pick the most recently active one whose entitlement matches the caller's org.
- Return the resulting subscription state.
- Used for the "Restore Purchases" button and as a recovery path after a verify failed earlier.

### `POST /api/v1/billing/iap/apple/webhook`

App Store Server Notifications V2. Body is a JWT `signedPayload`.

Behavior:
1. Verify the JWT signature against Apple's public keys.
2. Decode `notificationType` and `subtype`.
3. Dispatch per the table in the spec (SUBSCRIBED, DID_RENEW, EXPIRED, REFUND, GRACE_PERIOD_EXPIRED, etc.).
4. Idempotent — record `(notification_type, original_transaction_id)` in `iap_webhook_events` and skip duplicates.
5. Return 200 OK. Non-200 triggers Apple retries.

### `POST /api/v1/billing/iap/google/webhook`

Google Real-Time Developer Notifications via Pub/Sub.

Behavior:
1. Verify the Pub/Sub JWT signature.
2. Decode the inner `subscriptionNotification`.
3. Fetch authoritative state from `purchases.subscriptionsv2.get`.
4. Dispatch per the table in the spec.
5. ACK the Pub/Sub message.

---

## File structure / module layout

Map these responsibilities to your backend's conventions. Suggestion if you use Django:

```
billing/
  models.py             # Tier, OrgSubscription, IapReceipt, IapWebhookEvent
  views/
    catalog.py          # GET /catalog
    subscription.py     # GET /subscription
    iap.py              # POST /iap/verify, /iap/restore
    webhooks/
      apple.py          # POST /iap/apple/webhook
      google.py         # POST /iap/google/webhook
      stripe.py         # POST /stripe/webhook (existing; ensure same dispatcher pattern)
  services/
    apple_receipt.py    # validate w/ Apple App Store Server API
    google_receipt.py   # validate w/ Google Play Developer API
    entitlement.py      # core logic: receipt -> org -> subscription state
    webhook_dispatcher.py # shared dispatch helpers
  serializers.py
  migrations/
    XXXX_add_iap_tables.sql
```

If you use FastAPI / Express / Rails, equivalent module layout applies.

---

## Data model

Migrations (PostgreSQL syntax; adapt as needed):

```sql
-- Tier catalog (admin-managed; not user-facing)
CREATE TABLE tiers (
  id              VARCHAR PRIMARY KEY,
  name            VARCHAR NOT NULL,
  description     TEXT,
  features        JSONB NOT NULL DEFAULT '[]',
  asset_cap       INTEGER,
  duration        VARCHAR NOT NULL,
  ios_product_id  VARCHAR,
  android_product_id VARCHAR,
  stripe_price_id VARCHAR,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_subscriptions (
  org_id              INTEGER PRIMARY KEY REFERENCES organizations(id),
  source              VARCHAR NOT NULL,     -- "stripe" | "apple_iap" | "google_iap"
  external_id         VARCHAR NOT NULL,
  tier_id             VARCHAR REFERENCES tiers(id),
  status              VARCHAR NOT NULL,
  current_period_end  TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  purchasing_user_id  INTEGER REFERENCES users(id),
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE TABLE iap_receipts (
  id                    BIGSERIAL PRIMARY KEY,
  org_id                INTEGER REFERENCES organizations(id),
  user_id               INTEGER REFERENCES users(id),
  platform              VARCHAR NOT NULL,
  product_id            VARCHAR NOT NULL,
  transaction_id        VARCHAR NOT NULL,
  original_transaction_id VARCHAR,
  raw_receipt           TEXT NOT NULL,           -- encrypt at rest
  verification_response JSONB,
  verified_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, transaction_id)
);

CREATE TABLE iap_webhook_events (
  id                  BIGSERIAL PRIMARY KEY,
  platform            VARCHAR NOT NULL,
  notification_type   VARCHAR NOT NULL,
  external_id         VARCHAR,
  signed_payload      TEXT NOT NULL,
  processed_at        TIMESTAMPTZ,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Seed `tiers` with at least one row per platform product you've created in App Store Connect / Play Console. Mark grandfathered Stripe-metered orgs by inserting their `org_subscriptions` row with `source='stripe', tier_id='legacy_metered'` and a corresponding `tiers` row that has `is_active=false`.

---

## Task sequence

### Phase 0 — Foundations

**Task B1: Create `tiers`, `org_subscriptions`, `iap_receipts`, `iap_webhook_events` tables.** Migration + seed at least one test tier. Verify FK constraints work against existing `organizations` / `users` tables. **Acceptance:** can insert a row in each, FK referenced rows resolve.

**Task B2: Configure Apple App Store Server API credentials.** In App Store Connect, generate Issuer ID, Key ID, and `.p8` private key. Store as env vars (`APP_STORE_ISSUER_ID`, `APP_STORE_KEY_ID`, `APP_STORE_PRIVATE_KEY`, `APP_STORE_BUNDLE_ID`). **Acceptance:** library/client can mint a valid JWT for ASS API.

**Task B3: Configure Google Play Developer API service account.** GCP project, enable Play Developer API, create service account, grant access in Play Console (Users → service account → "View financial data" + "Manage orders"), download JSON key. Store path/contents in `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. **Acceptance:** can authenticate against the Play Developer API.

### Phase 1 — Read endpoints

**Task B4: Implement `GET /billing/catalog`.** Return only `is_active=true`, ordered by `sort_order`. Cache layer optional but recommended (catalog changes are rare). **Acceptance:** mobile's `fetchCatalog()` succeeds; tests pass.

**Task B5: Implement `GET /billing/subscription`.** Resolve via caller's org. Map DB row → response shape (compute `managed_in` from `source`). Return null fields when no subscription. **Acceptance:** mobile's `useSubscription` hook reports correct state for orgs in all four states (active stripe, active iap, none, refunded).

### Phase 2 — Apple receipt validation

**Task B6: Apple receipt validator service.** Function takes (receipt, transaction_id). Calls App Store Server API's `Get Transaction Info` and `Get All Subscription Statuses`. Decodes JWS responses. Returns canonical struct: `{ status, current_period_end, product_id, original_transaction_id, expiry_intent }`. Try production endpoint first; if response indicates sandbox receipt (`21007`), retry against sandbox. **Acceptance:** unit tests with fixture receipts pass (use Apple's sample data).

**Task B7: Entitlement linking service.** Function takes (org_id, user_id, validated_apple_payload). Checks no other active sub exists for this org. Upserts `org_subscriptions`. Records `iap_receipts`. Returns the new subscription state. **Acceptance:** test cases: new sub (success), org already has stripe (409 subscription_exists), same Apple ID for two orgs (409 receipt_already_consumed_by_other_org).

**Task B8: Implement `POST /billing/iap/verify` for iOS path.** Wires validator + linker. Handle error mapping. Return canonical subscription state on success. **Acceptance:** mobile sandbox purchase → endpoint returns 200 with correct state.

### Phase 3 — Google receipt validation

**Task B9: Google purchase validator service.** Function takes (purchase_token, product_id). Calls `purchases.subscriptionsv2.get` (the v2 endpoint, NOT the deprecated v1). Returns canonical struct from `lineItems`, `subscriptionState`, `expiryTime`. **Acceptance:** unit tests with Play Console sandbox tokens pass.

**Task B10: Extend `POST /billing/iap/verify` for Android path.** Same code path as iOS, dispatch on `platform`. **Acceptance:** mobile sandbox Android purchase → 200 with correct state.

### Phase 4 — Restore

**Task B11: Implement `POST /billing/iap/restore`.** Loops the receipt array, validates each, picks the most-recently-active matching the caller's org. Returns the resulting subscription state (or null fields if none match). **Acceptance:** uninstall/reinstall on a device → tap Restore → backend returns the existing sub.

### Phase 5 — Webhooks

**Task B12: Apple ASN2 webhook receiver.** POST endpoint. Verify JWS signature (Apple publishes the cert chain — use a library like `app-store-server-library`). Decode payload. Dispatch on `notificationType`. **Acceptance:** Apple's test notification utility delivers test events → backend logs them correctly.

**Task B13: Apple webhook dispatchers.** Per the table in the spec (DID_RENEW extends period_end, EXPIRED → status=expired, REFUND → status=refunded + entitlement lifted, etc.). Each handler is idempotent via the `iap_webhook_events` table. **Acceptance:** sandbox subscription renewal triggers `current_period_end` update; sandbox refund (initiate via App Store Connect) lifts entitlement.

**Task B14: Google Pub/Sub topic + push subscription.** Create the topic in GCP. Configure RTDN in Play Console pointing to your topic. Set up a push subscription that POSTs to `POST /billing/iap/google/webhook` with appropriate authentication. **Acceptance:** test notification from Play Console reaches the endpoint.

**Task B15: Google webhook receiver + dispatchers.** Decode the Pub/Sub envelope. Re-fetch authoritative state via `purchases.subscriptionsv2.get` rather than trusting the notification payload alone. Dispatch per the spec table. Idempotent. **Acceptance:** sandbox renewal/refund/cancel notifications produce correct state transitions.

### Phase 6 — Stripe alignment (if not already done)

**Task B16: Audit existing Stripe webhook handlers.** The `org_subscriptions` table replaces whatever existing model held Stripe state. Ensure Stripe webhook handlers (`customer.subscription.*`, `invoice.payment_failed`, etc.) write to `org_subscriptions` with `source='stripe'`. Backfill historical Stripe customers into `org_subscriptions` via migration. **Acceptance:** existing Stripe customers show `source='stripe', tier_id='legacy_metered'` after migration; new web Stripe purchases write the matching tier_id.

### Phase 7 — Hardening

**Task B17: Rate-limit `/billing/iap/verify` and `/billing/iap/restore`.** A misbehaving client could hammer these. Per-user rate limit (e.g. 20 verifies / hour). **Acceptance:** integration test with 21 rapid verifies sees the 21st rate-limited.

**Task B18: Encrypt `iap_receipts.raw_receipt` at rest.** Use your existing field-level encryption or KMS-backed encryption. Receipts are sensitive (they identify the Apple/Google account). **Acceptance:** raw column in DB is unreadable without the decryption key.

**Task B19: Add metrics + alerts.** Per-endpoint latency, validation success rate, webhook dispatch errors, queue depth for failed webhooks. Alert on webhook validation failure rate > 1% (could indicate Apple/Google rotating keys).

**Task B20: Add an admin tool for tier management.** Internal-only UI or shell command for inserting/editing rows in `tiers`. **Acceptance:** can add a new tier without a code deploy.

---

## Sequencing notes

- B1–B5 unblock most of the mobile UI (catalog/subscription read paths). The Settings → Subscription row stays gated until you set `EXPO_PUBLIC_IAP_ENABLED=true` in mobile's eas.json, so you can ship B1–B5 to staging first and flip the flag for QA.
- B6–B11 unblock actual purchase flow. Mobile can demo on sandbox once these land.
- B12–B15 are required before launching publicly — without webhooks, renewals/cancels/refunds aren't reflected.
- B16 is critical if any existing Stripe customers exist when you launch — they need to be in the new `org_subscriptions` table so `GET /billing/subscription` returns the right thing.

## Mobile/backend coordination

- Mobile pushes the JS for IAP, but the feature is **dark in production** until `EXPO_PUBLIC_IAP_ENABLED=true` is set at build time and a new `eas build --profile production` is shipped (need react-native-iap native module linked).
- Backend can ship endpoints incrementally without affecting production users.
- Recommended go-live sequence:
  1. Backend: B1–B16 in staging.
  2. Mobile: `eas build` a staging binary with `EXPO_PUBLIC_IAP_ENABLED=true`.
  3. QA the full happy path + edge cases on staging via TestFlight / Play internal track.
  4. Backend: deploy to prod, point Apple ASN2 + Google RTDN at prod URLs.
  5. Mobile: prod `eas build` + submit to stores. Once live, flip the flag.

## Open questions for the backend team

- Is `legacy_metered` the right placeholder name for grandfathered metered Stripe subs, or do you prefer something else?
- Should `is_primary` on org members give the primary owner sole control over IAP purchases, or can any admin purchase?
- Where do you want to record the link between an org's IAP sub and the *purchasing* Apple/Google account email? It's useful for support but Apple may consider that PII.

## References (Apple / Google docs the backend team will need)

- **Apple App Store Server API:** https://developer.apple.com/documentation/appstoreserverapi
- **Apple App Store Server Notifications V2:** https://developer.apple.com/documentation/appstoreservernotifications
- **Apple library (Java / Python / TS / Swift):** https://github.com/apple/app-store-server-library-* (one per language)
- **Google Play Developer API — subscriptionsv2:** https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
- **Google Real-Time Developer Notifications:** https://developer.android.com/google/play/billing/rtdn-reference
- **Reference notification types (Apple):** https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
- **Reference notification types (Google):** https://developer.android.com/google/play/billing/rtdn-reference#sub
