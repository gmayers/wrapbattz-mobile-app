# IAP Subscriptions — Apple App Store + Google Play

**Date:** 2026-05-12
**Status:** Draft (pending implementation plan)
**Scope:** Mobile (`@wrapbattz/app`) + Backend (`api.tooltraq.com`, separate repo). Both covered by this spec.

## Context

WrapBattz / TOOLTRAQ is a B2B device-management app. Today, organizations subscribe via web (Stripe, per-asset metered billing). We are:

1. Migrating away from per-asset metered billing to **flat subscription tiers**. Apple's IAP system does not support metered billing — products must be fixed-price, fixed-period subscriptions. The per-unit model also tangles with physical NFC tags, which can't be sold via IAP at all (Apple requires physical goods go through a separate channel).
2. Adding **in-app purchase** to the iOS and Android apps, since Apple's and Google's policies require IAP for any in-app purchase UI on a public store app. There is no formal "B2B exemption" we can invoke for a public App Store app; the only way to avoid IAP would be to ship no purchase UI at all on mobile, which is not what we want.

The mobile app and the backend are in separate repos, but this spec covers both because the contract between them is the load-bearing part of the design.

## Goals

- Org owners can subscribe via the iOS or Android app using IAP.
- Web/Stripe continues to work for orgs that prefer it (or for tiers above the IAP ladder).
- Backend is the single source of truth for an org's subscription state — mobile never trusts a raw receipt.
- Pricing/tier definitions are server-driven config, not hardcoded in the app — so pricing changes don't need an app update.
- Existing Stripe metered customers are grandfathered without forced migration.
- Webhook-driven state updates: renewals, refunds, cancellations, grace periods all flow from Apple/Google/Stripe → backend → mobile.

## Non-goals (v1)

- Introductory offers / free trials. App Store Connect supports these; can be added later without code changes.
- Promo codes (Apple Offer Codes, Google promo codes).
- Family Sharing (explicitly disabled at product level).
- In-app annual/monthly duration toggle. Ship monthly-only first; add annual product IDs in a follow-up.
- Tier upgrade/downgrade UX mid-period. Apple/Google handle crossgrades natively; we observe via webhook.
- Automated migration of existing Stripe metered customers to flat tiers (business call: grandfather them).

## Architecture

Two purchase channels, one source of truth.

```
┌───────────────────┐                          ┌──────────────────┐
│   Mobile (iOS)    │ ── IAP receipt ──────►   │                  │
│   StoreKit 2      │ ◄── entitlement ──────   │    Backend       │
└───────────────────┘                          │                  │
┌───────────────────┐                          │  Unified org     │
│   Mobile (Android)│ ── purchase token ──►    │  subscription    │
│   Play Billing v6 │ ◄── entitlement ──────   │  state           │
└───────────────────┘                          │                  │
┌───────────────────┐                          │  Source of truth │
│   Web (existing)  │ ── Stripe checkout ──►   │                  │
│   Stripe          │ ◄── customer/sub ──────  │                  │
└───────────────────┘                          └──────────────────┘
                                                        ▲
                                                        │ webhooks
                                                        │ (renewals,
                                                        │  refunds,
                                                        │  cancels)
                                                  ┌─────┴──────┐
                                                  │ Apple ASN2 │
                                                  │ Google PDN │
                                                  │ Stripe     │
                                                  └────────────┘
```

### Invariants

- Backend holds the authoritative `OrgSubscription` record. Source is `stripe`, `apple_iap`, or `google_iap`.
- Mobile **never** trusts IAP receipts directly. Every entitlement decision is read from `GET /billing/subscription` *after* the backend has validated.
- Each org has **at most one active subscription** regardless of source. Attempting IAP when an active Stripe sub exists → backend returns `409 Conflict` with `error.code = "subscription_exists"`.
- Webhooks are the only thing that mutates server state after initial verify. Mobile never directly mutates sub state.

### Library choice

**`react-native-iap`** (direct StoreKit/Play Billing bindings). Chosen over RevenueCat because:
- Client project — avoid third-party vendor lock-in and revenue share that the client hasn't approved.
- Backend already exists; we want full control of validation and webhook handling.
- No external dashboard dependency.

Trade-off: we own all validation/webhook/edge-case logic. That work lives in the backend spec below.

## Mobile module structure

New module `src/iap/` (parallel to `src/api/`, `src/auth/`). Existing files are kept but some are deprecated.

```
src/iap/
  index.ts                  # public surface (re-exports)
  IapService.ts             # singleton wrapper over react-native-iap:
                            # init(), getProducts(productIds), requestSubscription(),
                            # getAvailablePurchases() (restore), finishTransaction()
  receiptUploader.ts        # POSTs receipts to backend with retry
  pendingReceiptStore.ts    # SecureStore-backed queue of unverified receipts
                            # (Android pending purchases, offline, etc.)
  productCatalog.ts         # fetches tier catalog from backend,
                            # maps tier_id → platform product_id
  errors.ts                 # typed IapError class (codes: user_cancelled,
                            # network, store_unavailable, already_owned,
                            # pending, validation_failed, conflict)
  events.ts                 # small event bus for purchase lifecycle

src/screens/Subscribe/
  SubscribeScreen.tsx       # NEW: authenticated upgrade screen
                            # - shows tier ladder from /billing/catalog
                            # - shows current org subscription state
                            # - "Subscribe" CTA per tier (calls IapService)
                            # - "Restore Purchases" button (Apple required)
                            # - "Manage subscription" deep link to native
                            #   App Store / Play Store sub management
  hooks/
    useSubscription.ts      # reads /billing/subscription
    usePurchaseFlow.ts      # orchestrates: select tier → IAP →
                            # upload receipt → poll backend until
                            # entitlement is reflected → success/error

src/api/endpoints/
  billing.ts                # NEW endpoints (catalog, subscription, iap.verify,
                            # iap.restore). Subsumes the IAP-relevant parts
                            # of BillingService.
```

### Existing files

| File | Change |
|---|---|
| `src/services/BillingService.ts` | Keep; mark deprecated. New IAP-aware code uses `src/api/endpoints/billing.ts` + `src/iap/` directly. Stripe payment-method screens (`StripePaymentSheet.js`, `SubscriptionSetup.js`) continue to use BillingService for now — out of scope to refactor here. |
| `src/screens/PricingScreen.js` | Keep as-is for the pre-register marketing flow (no IAP needed there — the visitor isn't signed in yet). |
| `src/screens/PaymentScreens/ManageBillingScreen.js` | Update to render differently based on `subscription.source`: Stripe sources show existing Stripe management UI; IAP sources show a deep link to App Store / Play Store with explanatory copy. |
| `src/screens/Settings/sections.ts` | Add a "Subscription" row (admin-only) that opens `SubscribeScreen`. |
| `src/navigation/index.tsx` | Register `Subscribe` route. |

## Backend contract

All new endpoints under `/api/v1/billing/` (extending existing namespace).

### `GET /billing/catalog`

Returns active subscription tiers (filtered to `is_active=true`, sorted by `sort_order`). **Server-driven config** — adding/removing a tier or changing copy doesn't require an app update. The `legacy_metered` tier is `is_active=false` so it's hidden from this endpoint but still resolvable when reading existing subscriptions.

Response:
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

Mobile reads `ios_product_id` or `android_product_id` based on platform, fetches the matching `Product` from StoreKit/Play Billing for price/localized title, then renders the tier card with the **store-provided price string** (not the backend's). This is required by Apple — pricing displayed to the user must come from StoreKit.

### `GET /billing/subscription`

Current org's subscription state. Single source of truth.

Response:
```json
{
  "source": "stripe" | "apple_iap" | "google_iap" | null,
  "tier_id": "pro_monthly" | null,
  "status": "active" | "in_grace_period" | "expired" | "cancelled" | "refunded" | "pending",
  "current_period_end": "2026-06-12T00:00:00Z",
  "cancel_at_period_end": false,
  "purchasing_user_id": 123,
  "managed_in": "app_store" | "play_store" | "stripe_portal"
}
```

If no subscription, returns `{ "source": null, "status": null, ... }`.

### `POST /billing/iap/verify`

Body:
```json
{
  "platform": "ios" | "android",
  "product_id": "com.tooltraq.sub.pro.monthly",
  "transaction_id": "2000000123456789",
  "original_transaction_id": "2000000123456789",
  "receipt": "base64-encoded-receipt or unified-receipt",
  "purchase_token": "..."  // Android only
}
```

Backend:
1. Validates receipt with Apple App Store Server API (production endpoint first, fall back to sandbox if `Status: 21007`) or Google Play Developer API.
2. Checks the org has no other active subscription. If so, returns `409 { "code": "subscription_exists" }`.
3. Records the receipt in `iap_receipts`, deduped on `(platform, transaction_id)`.
4. Upserts `org_subscriptions` with `source`, `external_id` (original_transaction_id for Apple, purchase_token for Google), `tier_id` (derived from `product_id`), `status=active`, `current_period_end`.
5. Returns the updated `subscription` object (same shape as `GET /billing/subscription`).

Errors:
- `400 { "code": "invalid_receipt" }`
- `400 { "code": "unknown_product" }` (product_id doesn't match any tier)
- `409 { "code": "subscription_exists" }`
- `409 { "code": "receipt_already_consumed_by_other_org" }` (same Apple ID tried to buy for two orgs)
- `502 { "code": "store_unavailable" }` (Apple/Google API down — mobile should retry from queue)

### `POST /billing/iap/restore`

Body:
```json
{
  "platform": "ios" | "android",
  "receipts": [ { "transaction_id": "...", "receipt": "...", "product_id": "..." } ]
}
```

Mobile sends every receipt returned by `getAvailablePurchases()`. Backend re-validates each, picks the one that matches the caller's org (or returns the most recent active one), and returns the resulting subscription state. Used by the "Restore Purchases" button (Apple required) and as a recovery path if a verify call failed earlier.

### `POST /billing/iap/apple/webhook`

Apple App Store Server Notifications v2. Body is a signed JWT (`signedPayload`).

Backend:
1. Verifies JWT signature against Apple's public keys.
2. Extracts `notificationType` and `subtype`. Dispatch table:

| notificationType | Action |
|---|---|
| `SUBSCRIBED` | Idempotent — usually already handled by `/verify`. Confirm state. |
| `DID_RENEW` | Extend `current_period_end`. |
| `DID_FAIL_TO_RENEW` (subtype `BILLING_RETRY`) | Set `status=in_grace_period`. |
| `GRACE_PERIOD_EXPIRED` | Set `status=expired`. |
| `EXPIRED` | Set `status=expired`. |
| `REFUND` | Set `status=refunded`, lift entitlement. |
| `REVOKE` (Family Sharing) | Set `status=expired` (Family Sharing should be off anyway). |
| `DID_CHANGE_RENEWAL_STATUS` | Update `cancel_at_period_end`. |
| `PRICE_INCREASE` | Log; surface in mobile UI next time user opens. |

3. Returns `200 OK`. Apple retries non-200.

### `POST /billing/iap/google/webhook`

Google Real-Time Developer Notifications via Pub/Sub. Body wraps a base64 payload.

Backend:
1. Verifies Pub/Sub JWT signature.
2. Decodes the inner `subscriptionNotification`.
3. Calls Google Play Developer API `purchases.subscriptionsv2.get` to fetch authoritative state.
4. Dispatch on `notificationType`:

| notificationType | Action |
|---|---|
| `SUBSCRIPTION_PURCHASED` (1) | Confirm — usually already handled by `/verify`. |
| `SUBSCRIPTION_RENEWED` (2) | Extend `current_period_end`. |
| `SUBSCRIPTION_CANCELED` (3) | Set `cancel_at_period_end=true`. |
| `SUBSCRIPTION_ON_HOLD` (5) | Set `status=in_grace_period`. |
| `SUBSCRIPTION_IN_GRACE_PERIOD` (6) | Set `status=in_grace_period`. |
| `SUBSCRIPTION_RESTARTED` (7) | Restore entitlement. |
| `SUBSCRIPTION_EXPIRED` (13) | Set `status=expired`. |
| `SUBSCRIPTION_REVOKED` (12) | Set `status=refunded`. |
| `SUBSCRIPTION_PAUSED` (10) | Set `status=expired` (we don't support pause). |

5. ACK to Pub/Sub. Pub/Sub retries non-ACKed.

### `POST /billing/stripe/webhook` (already exists or to-be-added)

Same dispatcher pattern: `customer.subscription.created/updated/deleted/trial_will_end`, `invoice.payment_failed`, `invoice.paid`. Out of scope to fully spec here — but the data model below assumes Stripe webhook lands in the same `org_subscriptions` table.

## Backend data model

```sql
-- Tier catalog (admin-managed via internal tool, not user-facing)
CREATE TABLE tiers (
  id              VARCHAR PRIMARY KEY,     -- e.g. "pro_monthly"
  name            VARCHAR NOT NULL,
  description     TEXT,
  features        JSONB NOT NULL DEFAULT '[]',  -- ["Up to 50 assets", ...]
  asset_cap       INTEGER,                  -- NULL = unlimited
  duration        VARCHAR NOT NULL,         -- "monthly" | "annual"
  ios_product_id  VARCHAR,
  android_product_id VARCHAR,
  stripe_price_id VARCHAR,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One subscription per org, regardless of source
CREATE TABLE org_subscriptions (
  org_id              INTEGER PRIMARY KEY REFERENCES organizations(id),
  source              VARCHAR NOT NULL,     -- "stripe" | "apple_iap" | "google_iap"
  external_id         VARCHAR NOT NULL,     -- stripe sub_id | apple original_tx_id | google purchase_token
  tier_id             VARCHAR REFERENCES tiers(id),
  status              VARCHAR NOT NULL,     -- "active" | "in_grace_period" | "expired" | "cancelled" | "refunded" | "pending"
  current_period_end  TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  purchasing_user_id  INTEGER REFERENCES users(id),  -- who bought it; separate from org.owner_id
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

-- Audit log + dedup for receipts
CREATE TABLE iap_receipts (
  id                    BIGSERIAL PRIMARY KEY,
  org_id                INTEGER REFERENCES organizations(id),
  user_id               INTEGER REFERENCES users(id),
  platform              VARCHAR NOT NULL,   -- "ios" | "android"
  product_id            VARCHAR NOT NULL,
  transaction_id        VARCHAR NOT NULL,
  original_transaction_id VARCHAR,
  raw_receipt           TEXT NOT NULL,      -- encrypted at rest
  verification_response JSONB,
  verified_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, transaction_id)
);

-- Webhook event log (idempotency + replay)
CREATE TABLE iap_webhook_events (
  id                  BIGSERIAL PRIMARY KEY,
  platform            VARCHAR NOT NULL,
  notification_type   VARCHAR NOT NULL,
  external_id         VARCHAR,             -- ties to org_subscriptions.external_id
  signed_payload      TEXT NOT NULL,
  processed_at        TIMESTAMPTZ,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Mobile flow — purchase happy path

```
1. User opens SubscribeScreen
   → useSubscription() fetches GET /billing/subscription
   → productCatalog.fetch() fetches GET /billing/catalog
   → IapService.getProducts([all ios_product_ids OR android_product_ids])
   → render tier cards with store-provided localized prices

2. User taps "Subscribe" on a tier
   → usePurchaseFlow.purchase(tier)
   → IapService.requestSubscription({ sku: tier.product_id })
   → react-native-iap surfaces native purchase sheet
   → user confirms → store returns purchase object

3. Mobile receives purchase
   → receiptUploader.upload(purchase)
     - POST /billing/iap/verify with receipt + product_id + transaction_id
     - backend validates with Apple/Google
     - backend returns updated subscription
   → IapService.finishTransaction(purchase) (acknowledges to store)
   → useSubscription invalidates and re-fetches
   → SubscribeScreen renders new "active" state

4. If step 3 fails (network, backend down):
   → push purchase onto pendingReceiptStore (SecureStore queue)
   → DO NOT finishTransaction yet — Apple/Google will keep redelivering
   → background retry on next app open / network reachable
   → only finishTransaction after successful verify
```

## Mobile flow — restore purchases

```
1. User taps "Restore Purchases" on SubscribeScreen
   → IapService.getAvailablePurchases()
   → returns array of past purchases tied to current Apple ID / Google account
2. Mobile POSTs all of them to /billing/iap/restore
   → backend re-validates each, picks the one matching caller's org,
     or returns the most recent active one
3. useSubscription refreshes
4. If a purchase matched, show success toast.
   If none matched the org but receipts exist, show error explaining the
   subscription belongs to a different organization.
```

## Edge cases

| Case | Handling |
|---|---|
| **Owner change mid-subscription** | IAP entitlement stays with the purchasing Apple ID/Google account. `org_subscriptions.purchasing_user_id` is separate from `org.owner_id` — survives ownership transfer. Surface in admin UI: "Subscription managed by `<purchaser email>` — only they can cancel from the App Store." |
| **Org already has Stripe sub, user buys via IAP** | Backend rejects `/verify` with `409 subscription_exists`. Mobile shows: "Your org already has an active subscription managed via web — manage it at tooltraq.com." Do not call `finishTransaction` — let Apple refund automatically. |
| **Same Apple ID tries to subscribe two orgs** | Backend rejects with `409 receipt_already_consumed_by_other_org`. User must use a different Apple ID for the second org. |
| **Cancellation** | App **never** cancels directly. "Cancel" button deep-links to `https://apps.apple.com/account/subscriptions` on iOS or `https://play.google.com/store/account/subscriptions?package=...&sku=...` on Android. Webhook updates state when cancel takes effect at period end. |
| **Refund** | Handled exclusively via webhook (`REFUND` / `REVOKED`). Backend marks `refunded`, lifts entitlement. Mobile reads new state on next focus. |
| **Grace period** | Apple/Google retry billing for ~16 days. Backend marks `in_grace_period`; mobile shows banner "Payment issue — update your payment method." Banner deep-links to native sub management. |
| **Android pending purchases** | Slow/cash payment can leave a purchase in pending state for hours/days. `requestSubscription` returns `purchaseState = 2 (PENDING)`. Don't call finishTransaction; show "Purchase pending — we'll confirm when it clears." Background polling via webhook handles confirmation. |
| **Family Sharing** | **Disabled** at App Store Connect product level (toggle off). If a `REVOKE` notification ever arrives, treat as expired. |
| **Network failure during verify** | Receipt goes into `pendingReceiptStore`. Retried on next app focus or network reachable. Apple/Google keep the purchase pending on their side, so this is recoverable. |
| **User reinstalls app** | "Restore Purchases" flow recovers existing subscription. No new purchase needed. |
| **User signs in to a different org** | Subscription is **org-scoped**. Their entitlement comes from the org they're acting as. If they switch orgs (rare), the displayed subscription changes accordingly. |
| **Sandbox vs production** | Apple: validate against production endpoint first; if response `status: 21007`, retry against sandbox. Google: separate test track configured in Play Console; backend uses same code path, environment determines API target. |

## Migration plan for existing Stripe customers

- **Grandfather**, no auto-migrate. Their `org_subscriptions` row gets `source = stripe`, `tier_id = legacy_metered` (a synthetic tier hidden from `GET /billing/catalog`).
- Their `Settings → Subscription` screen shows a "Legacy plan" badge and a "Switch to new plan — contact support" CTA. No automated migration. Sales/support handles case-by-case if customers want to move.
- New Stripe customers (web) use the new flat tiers as well.
- Apple and Google never see grandfathered orgs through IAP.

## Configuration & store setup

This work is config in App Store Connect / Play Console, not code. Spec documents what's required so the implementation plan can include a checklist.

### App Store Connect

- Bundle ID, capabilities: **In-App Purchase** capability enabled in Xcode project.
- For each tier × duration, create an **Auto-Renewable Subscription** product.
  - Product ID convention: `com.tooltraq.sub.<tier>.<duration>`. Example: `com.tooltraq.sub.pro.monthly`.
  - All subs in **one Subscription Group** (Apple allows users to switch between them).
  - **Family Sharing: OFF.**
  - Localized title + description.
  - Price set per territory (Apple's current pricing model supports ~700 price points; choose a base price and let App Store Connect generate proposed regional prices).
- App Store Server Notifications V2: webhook URL set to `https://api.tooltraq.com/api/v1/billing/iap/apple/webhook`.
- App Store Server API: generate an issuer ID + key for backend receipt validation.
- Tax category, paid agreements, banking info: must be complete before subs can ship.

### Google Play Console

- Application licensing key + service account JSON for backend.
- For each tier × duration, create a **Subscription** product.
  - Product ID convention: `tooltraq_sub_<tier>_<duration>`. Example: `tooltraq_sub_pro_monthly`.
  - Base plan + offer structure (v6 Play Billing).
- Real-Time Developer Notifications: Pub/Sub topic, push subscription URL set to `https://api.tooltraq.com/api/v1/billing/iap/google/webhook`.
- Google Play Developer API enabled in GCP project; service account granted role.

### Backend secrets/config

- `APP_STORE_ISSUER_ID`
- `APP_STORE_KEY_ID`
- `APP_STORE_PRIVATE_KEY` (P8)
- `APP_STORE_BUNDLE_ID`
- `GOOGLE_PLAY_PACKAGE_NAME`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `IAP_WEBHOOK_SECRET` (shared secret for webhook payload signing, if Pub/Sub auth not used)

## Testing strategy

- **Unit (mobile):** mock react-native-iap, test `usePurchaseFlow` state machine, `receiptUploader` retry behavior, `pendingReceiptStore` persistence.
- **Unit (backend):** mock Apple/Google API responses; test verify, restore, webhook dispatchers for every notification type in the dispatch tables above. Test idempotency: same webhook delivered twice → only one state change.
- **Integration (mobile):** physical device with sandbox Apple ID / Play license test account. Exercise: subscribe, restore, cancel, refund (via App Store Connect "Refund" action), grace period (via Apple sandbox time-warp).
- **Integration (backend):** Apple sandbox transactions, Google test track. Verify webhook delivery; verify state transitions.
- **End-to-end:** subscribe on physical device → confirm `GET /billing/subscription` updates → cancel from App Store → confirm webhook updates state → confirm app reflects.

## Risks & open questions

- **Owner cancels from their personal Apple ID after leaving the company.** Can't engineer around — surface in admin UI and via email warning.
- **Backend implementation language/framework.** Not specified in this repo. The backend team has their own conventions; this spec defines the contract, not the implementation. The writing-plans phase should produce a separate plan for the backend team.
- **Annual plans.** Deferred to v2; product IDs reserved (`...annual`) so they can be added without a model change.
- **Free trial / introductory offers.** Deferred; can be added via App Store Connect without code changes.
- **Apple promo codes / Google promo codes.** Deferred.
- **Exchange rate / price localization.** Handled automatically by App Store / Play Store; mobile must use the store-provided price string (not the backend's), required by Apple.

## Out of repo

- Tier definitions and prices: configured in App Store Connect, Play Console, and the backend's `tiers` table. Not in this repo.
- Webhook secrets, service account JSONs: backend ops.
- Marketing copy on store listings: separate workflow.

## QA checklist (mobile)

Requires:
- A new `eas build --profile production` after the mobile plan landed (react-native-iap native module won't link in older bundles).
- Sandbox Apple ID + Play Console license test account.
- At least one Auto-Renewable Subscription product in App Store Connect AND one Subscription product in Play Console, with sandbox pricing.
- Backend `/billing/catalog`, `/billing/subscription`, `/billing/iap/verify`, `/billing/iap/restore` reachable (mock or real).
- `EXPO_PUBLIC_IAP_ENABLED=true` set so Settings → Subscription is visible.

### Happy path
- [ ] Sign in as an org owner with no active sub. Open Settings → Subscription. See tier list with **store-provided** prices (not backend-provided).
- [ ] Tap Subscribe on a tier. Native sheet appears. Confirm. App shows "verifying" then "active". Settings shows new plan. Backend `/billing/subscription` returns the new state.

### Restore
- [ ] Uninstall and reinstall the app. Sign in. Open Subscription. Tap "Restore purchases". App shows "Restored" toast. State is correct.

### Cancel
- [ ] On an active IAP-sourced sub, tap "Manage subscription". Native subscription management opens. Cancel from there. Reopen app. State updates (via webhook → backend → mobile refresh on focus).

### Already-subscribed conflict
- [ ] On an org that already has a Stripe sub, attempt to subscribe via IAP. Backend returns 409. App shows the conflict message and refunds automatically via Apple/Google (no `finishTransaction` called).

### Network failure
- [ ] Disable network mid-purchase. Confirm purchase in native sheet. App shows error, but on re-enabling network the queued receipt is processed on next app focus.

### Android pending
- [ ] Use a cash payment in Play sandbox. App shows "pending". Later webhook delivers, state becomes "active" on next refresh.

### ManageBilling routing
- [ ] On an IAP-sourced sub, open Settings → Manage Billing. Screen shows "Managed via [store]" and a deep-link button (NOT the Stripe controls).
- [ ] On a Stripe-sourced (or no) sub, the existing Stripe-driven UI renders unchanged.
