# Mobile Google Sign-in / Sign-up — Design

**Date:** 2026-07-03
**Branch:** `feat/google-signin-mobile`
**Status:** Approved design; implementation blocked on backend deploy (see Prerequisites).
**Backend contract:** `gmayers/tooltraq` branch `feat/mobile-google-signup-onboarding`
(spec: `tooltraq/docs/superpowers/specs/2026-06-23-mobile-google-signup-onboarding-token-design.md`).

## Problem

The mobile app has no social authentication. The old Google/Apple buttons were
removed (they were never wired). The backend now implements a native Google
OAuth flow (`POST /api/v1/auth/oauth/authorize/` + `POST /api/v1/auth/oauth/callback/`)
on an unmerged branch; the mobile side must be ready to ship the moment it deploys.

## Scope

- Google sign-in AND sign-up buttons on the Login and Register screens, **both
  platforms in code**.
- **Release gated to the Android OTA channel** until Apple sign-in exists:
  App Store guideline 4.8 requires a privacy-equivalent login option, so no iOS
  release (build or OTA) may ship the Google button before Apple sign-in lands
  or the button is gated off iOS.
- Non-goals: Apple/Microsoft providers (backend is `Literal["GoogleOAuth"]`),
  PKCE (backend v1 decision — `state` covers CSRF), account linking UI,
  phone capture at signup (done later via the profile step).

## Backend contract (verbatim from the branch)

- `POST /auth/oauth/authorize/` (no auth) — request
  `{ provider: "GoogleOAuth", state: string (min 1), screen_hint: "sign-up" | "sign-in" }`
  → `200 { authorization_url: string }`.
  Errors: `503 oauth_unavailable` ("Google sign-in is not configured.") when the
  backend redirect URI env is unset; rate-limited (~10/min).
- `POST /auth/oauth/callback/` (no auth) — request `{ code: string (min 1) }`
  → `200 TokenResponse` (identical shape to `/auth/login/`).
  Errors: any failure → `401 oauth_failed` ("Google sign-in could not be completed.");
  rate-limited.
- Browser redirect target: the deep link configured as
  `WORKOS_API_OAUTH_REDIRECT_URI` on the backend — **`tooltraq://auth/callback`** —
  which WorkOS calls with `?code=...&state=...` (or `?error=...` on
  denial/cancel).
- New Google users are created server-side (`get_or_create_user_from_workos`)
  with `has_completed_onboarding` false — the existing mobile onboarding gate
  handles them with no client changes.
- Related (already handled server-side): `POST /auth/token/refresh/` accepts
  optional `organization_id` and auto-upgrades to an org-scoped token when the
  user has exactly one membership. The mobile refresh wrapper needs no change
  for this feature; new-org token handoff is covered by the backend's
  single-membership auto-resolution.

## Design

### Flow

1. User taps **Continue with Google** on Login (`screen_hint: "sign-in"`) or
   Register (`screen_hint: "sign-up"`).
2. Client generates `state` = 32 hex chars from `expo-crypto`
   `getRandomBytesAsync(16)`.
3. `POST /auth/oauth/authorize/` → `authorization_url`.
4. `WebBrowser.openAuthSessionAsync(authorization_url, 'tooltraq://auth/callback')`
   opens the system browser and resolves with `{ type: 'success', url }` when
   WorkOS redirects to the deep link (or `{ type: 'cancel' | 'dismiss' }`).
5. Parse `code` + `state` from the returned URL. **Reject unless the returned
   `state` strictly equals the generated one.**
6. `POST /auth/oauth/callback/` `{ code }` → `TokenResponse` →
   `persistTokenResponse` (existing helper: stores access/refresh/expiry in
   SecureStore) → `applyUser(response.user)` in AuthContext.
7. Navigation falls out of existing state: `has_completed_onboarding` false →
   onboarding wizard; otherwise main app. No new navigation code.

### Components

| Unit | Responsibility |
|---|---|
| `src/api/endpoints/auth.ts` (extend) | `oauthAuthorize(payload: OAuthAuthorizeRequest): Promise<OAuthAuthorizeResponse>`; `oauthCallback(code: string): Promise<TokenResponse>` — callback pipes through `persistTokenResponse` exactly like `login`. Request/response types added to `src/api/types.ts` (hand-written until the regenerated schema includes the OAuth paths, mirroring the `ToolLifecycleFields` precedent). |
| `src/auth/googleSignIn.ts` (new) | `signInWithGoogle(screenHint: 'sign-in' | 'sign-up'): Promise<TokenResponse | null>` — orchestrates steps 2–6; returns `null` on user cancel/dismiss. Exports pure helpers for tests: `parseOAuthRedirect(url: string, expectedState: string): { code: string }` (throws `OAuthRedirectError` with a `reason` of `state_mismatch` \| `missing_code` \| `provider_error`) and `REDIRECT_URI = 'tooltraq://auth/callback'`. |
| `src/auth/AuthContext.tsx` (extend) | `loginWithGoogle(screenHint): Promise<UserMe | null>` — calls the orchestrator, `applyUser(response.user)` on success, `null` passthrough on cancel. |
| `src/components/GoogleSignInButton.tsx` (new) | Themed button ("Continue with Google", Ionicons `logo-google`), `disabled`/spinner while in flight, `accessibilityRole="button"`. Rendered by both auth screens with an "or" divider. |
| Login/Register screens (extend) | Button below the primary submit; Login passes `sign-in`, Register `sign-up`. In-flight state local to the screen. |

### Error handling

| Case | Behaviour |
|---|---|
| Browser result `cancel`/`dismiss` | Silent no-op (return `null`, button re-enables). |
| Redirect has `?error=...` (user denied) | Silent no-op, same as cancel. |
| `state` mismatch | Alert "Google sign-in failed. Please try again." — never calls the callback endpoint. |
| Missing `code` in redirect | Same alert as state mismatch. |
| `503 oauth_unavailable` | Alert "Google sign-in isn't available yet. Please use email and password." (covers the pre-deploy window). |
| `401 oauth_failed` | Alert with the server message ("Google sign-in could not be completed."). |
| Network/timeout `ApiError` | Existing message pattern: alert with `error.message`. |

Unlike the rest of the app, a 401 (`unauthorized` code) from the OAuth endpoints
is **shown, not skipped**: these endpoints are unauthenticated (excluded from the
refresh and attach-token interceptors), so a 401 means `oauth_failed`, never an
expired session.

### Testing

- Unit (jest): `parseOAuthRedirect` — happy path, state mismatch, missing code,
  `error` param, malformed URL; endpoint wrappers with mocked client (callback
  persists tokens). Baseline rule: no new failures beyond the 7 known suites.
- On-device (after backend deploy): full round-trip on Android — new-user
  signup lands in onboarding; existing-user signin lands on dashboard; cancel
  mid-flow; airplane-mode failure.

## Prerequisites (user-owned, before the mobile feature can work)

1. Merge/deploy backend `feat/mobile-google-signup-onboarding` (note: carries
   unrelated billing commits — ship whole or cherry-pick the OAuth work).
2. Set `WORKOS_API_OAUTH_REDIRECT_URI=tooltraq://auth/callback` in the API env.
3. Register `tooltraq://auth/callback` as a redirect URI in the WorkOS
   dashboard (Google provider enabled).
4. After deploy: regenerate `docs/api/openapi.json` + `npm run api:types` so the
   OAuth paths land in the generated schema; replace the hand-written types.

## Release

- JS-only. Verified against production build commit `6d4a876`: `expo-web-browser`
  `~15.0.10`, `expo-crypto` `~15.0.8`, and `"scheme": "tooltraq"` are all
  present in the deployed native builds — the feature OTAs cleanly.
- Publish to the **Android production OTA channel only**. The 503 fallback makes
  it safe to ship the client before the backend is live, but the intended order
  is backend first.
- Bump `CHANGELOG_VERSION` with a "Sign in with Google" entry when shipping.
