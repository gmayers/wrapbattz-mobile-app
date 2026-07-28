# Mobile Google Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Continue with Google" sign-in/sign-up on the Login and Register screens, driving the backend's native OAuth flow end-to-end, shippable before the backend deploys (503 fallback) — per `docs/superpowers/specs/2026-07-03-google-signin-mobile-design.md`.

**Architecture:** Three layers: hand-written OAuth types + two endpoint wrappers in the existing API layer; a `googleSignIn.ts` orchestrator (state generation → authorize call → `WebBrowser.openAuthSessionAsync` → redirect parsing with strict state check → callback call) whose pure parts are unit-tested; a dumb themed button wired into both auth screens through a new `loginWithGoogle` AuthContext action that reuses `applyUser` so onboarding/main routing falls out of existing state.

**Tech Stack:** React Native 0.81 / Expo SDK 54, `expo-web-browser` ~15.0.10 and `expo-crypto` ~15.0.8 (both already installed AND in the deployed native builds), TypeScript, Jest.

## Global Constraints

- Branch: `feat/google-signin-mobile` (already checked out).
- JS-only; no new dependencies of any kind (OTA on runtime 1.0.0).
- Deep-link redirect URI, exact: `tooltraq://auth/callback` (scheme `tooltraq` already in app.json + deployed builds).
- Backend contract (verbatim): `POST /auth/oauth/authorize/` body `{ provider: 'GoogleOAuth', state, screen_hint: 'sign-up' | 'sign-in' }` → `{ authorization_url }`; `POST /auth/oauth/callback/` body `{ code }` → `TokenResponse`. Errors: 503 `oauth_unavailable`, 401 `oauth_failed`.
- **The working tree has uncommitted user-owned changes to `docs/api/openapi.json` and `src/api/generated/schema.ts` — do NOT touch, stage, or commit these files. Never use `git add -A` / `git add .`; always stage explicit paths.**
- **RN gotcha:** `new URL(x).searchParams` THROWS at runtime in React Native (Node's URL in Jest hides this). Redirect parsing must use manual string parsing — no `URL`/`URLSearchParams` in `src/` code for this feature.
- Jest baseline: exactly 7 pre-existing failing suites (Button, FormField, PasswordField, AuthFlow, BillingService, NFCService, NFCUtils) with `npx jest --testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\."` — no new failures.
- Imports: NEW modules and tests use the `@/` alias (maps to `src/`; resolved by tsconfig, Jest `moduleNameMapper`, and Expo Metro tsconfig-paths). Same-directory siblings stay `./`; single imports added to existing legacy files match that file's relative style. User-facing copy says "Google sign-in", tools-not-devices vocabulary elsewhere.

---

### Task 1: OAuth types + endpoint wrappers

**Files:**
- Modify: `src/api/types.ts` (append near the other hand-written types, after `ToolLifecycleFields`)
- Modify: `src/api/endpoints/auth.ts`
- Modify: `src/api/interceptors/refreshOn401.ts:10-15` (`NON_REFRESHABLE_PATHS`)
- Test: `src/tests/unit/oauthEndpoints.test.ts`

**Interfaces:**
- Produces: `OAuthAuthorizeRequest`, `OAuthAuthorizeResponse` types in `src/api/types.ts`; `oauthAuthorize(payload: OAuthAuthorizeRequest): Promise<OAuthAuthorizeResponse>` and `oauthCallback(code: string): Promise<TokenResponse>` in `src/api/endpoints/auth.ts`. `oauthCallback` persists tokens exactly like `login` (via the module's `persistTokenResponse`).
- **Interceptor exclusion (required):** add `'/auth/oauth/'` to `NON_REFRESHABLE_PATHS` in `src/api/interceptors/refreshOn401.ts` (one prefix covers authorize + callback). Without it, the backend's `401 oauth_failed` on `/auth/oauth/callback/` triggers a spurious token-refresh attempt — these endpoints are unauthenticated (`auth=None`); a 401 there is a sign-in failure, not an expired session.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/unit/oauthEndpoints.test.ts
import { apiClient } from '../../api/client';
import { oauthAuthorize, oauthCallback } from '../../api/endpoints/auth';

jest.mock('../../api/client', () => ({
  apiClient: { post: jest.fn() },
}));
jest.mock('../../api/tokenStore', () => ({
  save: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

const mockedPost = apiClient.post as jest.Mock;

describe('oauthAuthorize', () => {
  it('POSTs the authorize payload and returns the authorization URL', async () => {
    mockedPost.mockResolvedValueOnce({ data: { authorization_url: 'https://auth.example/x' } });
    const res = await oauthAuthorize({ provider: 'GoogleOAuth', state: 'abc', screen_hint: 'sign-in' });
    expect(mockedPost).toHaveBeenCalledWith('/auth/oauth/authorize/', {
      provider: 'GoogleOAuth',
      state: 'abc',
      screen_hint: 'sign-in',
    });
    expect(res.authorization_url).toBe('https://auth.example/x');
  });
});

describe('oauthCallback', () => {
  it('POSTs the code and persists the token response', async () => {
    const tokens = {
      access_token: 'A'.repeat(20),
      refresh_token: 'R'.repeat(20),
      expires_in: 3600,
      user: { id: 1, email: 'a@b.com' },
    };
    mockedPost.mockResolvedValueOnce({ data: tokens });
    const res = await oauthCallback('the-code');
    expect(mockedPost).toHaveBeenCalledWith('/auth/oauth/callback/', { code: 'the-code' });
    const { save } = require('../../api/tokenStore');
    expect(save).toHaveBeenCalledWith({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expires_in,
    });
    expect(res).toEqual(tokens);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/unit/oauthEndpoints.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: FAIL — `oauthAuthorize` is not exported.

- [ ] **Step 3: Implement**

`src/api/types.ts` — append:

```ts
// OAuth (hand-written until docs/api/openapi.json includes the /auth/oauth/*
// paths — same precedent as ToolLifecycleFields; replace with generated types
// after the backend branch deploys and types are regenerated).
export interface OAuthAuthorizeRequest {
  provider: 'GoogleOAuth';
  state: string;
  screen_hint: 'sign-up' | 'sign-in';
}
export interface OAuthAuthorizeResponse {
  authorization_url: string;
}
```

`src/api/endpoints/auth.ts` — add `OAuthAuthorizeRequest, OAuthAuthorizeResponse` to the existing type import from `'../types'`, then append after `login`:

```ts
export async function oauthAuthorize(
  payload: OAuthAuthorizeRequest
): Promise<OAuthAuthorizeResponse> {
  const { data } = await apiClient.post<OAuthAuthorizeResponse>('/auth/oauth/authorize/', payload);
  return data;
}

export async function oauthCallback(code: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/oauth/callback/', { code });
  return persistTokenResponse(data);
}
```

`src/api/interceptors/refreshOn401.ts` — extend the exclusion list (lines 10-15) with one entry:

```ts
const NON_REFRESHABLE_PATHS = [
  '/auth/login/',
  '/auth/register/',
  '/auth/verify-email/',
  '/auth/password/forgot/',
  '/auth/password/reset/',
  '/auth/token/refresh/',
  '/auth/oauth/', // authorize + callback are auth=None; a 401 here is oauth_failed, not an expired session
];
```

(Match the actual array formatting in the file; only the `'/auth/oauth/',` line is new.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tests/unit/oauthEndpoints.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: PASS (2 tests). Note: if the module-level `console.log` in `persistTokenResponse` prints, that's pre-existing behavior — not a failure.

- [ ] **Step 5: Commit**

```bash
git add src/api/types.ts src/api/endpoints/auth.ts src/tests/unit/oauthEndpoints.test.ts
git commit -m "feat(auth): OAuth authorize/callback endpoint wrappers"
```

---

### Task 2: googleSignIn orchestrator with pure redirect parsing

**Files:**
- Create: `src/auth/googleSignIn.ts`
- Test: `src/tests/unit/googleSignIn.test.ts`

**Interfaces:**
- Consumes: `oauthAuthorize`, `oauthCallback` from Task 1.
- Produces:
  - `REDIRECT_URI = 'tooltraq://auth/callback'`
  - `class OAuthRedirectError extends Error { reason: 'state_mismatch' | 'missing_code' | 'provider_error' }`
  - `parseOAuthRedirect(url: string, expectedState: string): { code: string }` (throws `OAuthRedirectError`)
  - `signInWithGoogle(screenHint: 'sign-in' | 'sign-up'): Promise<TokenResponse | null>` — `null` on user cancel/dismiss or provider-denied; throws `OAuthRedirectError` on state mismatch / missing code; rethrows `ApiError` from the endpoints.
  - `googleSignInAlert(err: unknown): { title: string; message: string }` — maps errors to the spec's alert copy. Always returns copy: on these unauthenticated endpoints even a 401 is a user-facing failure (`oauth_failed`), never a session expiry. Silent cases (cancel/dismiss/denied) never reach this function — `signInWithGoogle` returns `null` for them instead of throwing.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/unit/googleSignIn.test.ts
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(16).fill(0xab)),
}));
jest.mock('../../api/endpoints/auth', () => ({
  oauthAuthorize: jest.fn(),
  oauthCallback: jest.fn(),
}));

import * as WebBrowser from 'expo-web-browser';
import { oauthAuthorize, oauthCallback } from '../../api/endpoints/auth';
import {
  parseOAuthRedirect,
  signInWithGoogle,
  googleSignInAlert,
  OAuthRedirectError,
  REDIRECT_URI,
} from '../../auth/googleSignIn';
import { ApiError } from '../../api/errors';

const mockedOpen = WebBrowser.openAuthSessionAsync as jest.Mock;
const mockedAuthorize = oauthAuthorize as jest.Mock;
const mockedCallback = oauthCallback as jest.Mock;

describe('parseOAuthRedirect', () => {
  const S = 'expected-state';
  it('extracts the code when state matches', () => {
    expect(parseOAuthRedirect(`tooltraq://auth/callback?code=c123&state=${S}`, S)).toEqual({ code: 'c123' });
  });
  it('decodes URL-encoded values', () => {
    expect(parseOAuthRedirect(`tooltraq://auth/callback?code=a%2Bb&state=${S}`, S)).toEqual({ code: 'a+b' });
  });
  it('throws state_mismatch when state differs', () => {
    expect(() => parseOAuthRedirect(`tooltraq://auth/callback?code=c&state=evil`, S))
      .toThrow(expect.objectContaining({ reason: 'state_mismatch' }));
  });
  it('throws state_mismatch when state is absent', () => {
    expect(() => parseOAuthRedirect('tooltraq://auth/callback?code=c', S))
      .toThrow(expect.objectContaining({ reason: 'state_mismatch' }));
  });
  it('throws missing_code when code is absent', () => {
    expect(() => parseOAuthRedirect(`tooltraq://auth/callback?state=${S}`, S))
      .toThrow(expect.objectContaining({ reason: 'missing_code' }));
  });
  it('throws provider_error when the provider returned an error param', () => {
    expect(() => parseOAuthRedirect(`tooltraq://auth/callback?error=access_denied&state=${S}`, S))
      .toThrow(expect.objectContaining({ reason: 'provider_error' }));
  });
  it('throws missing_code on a URL with no query string', () => {
    expect(() => parseOAuthRedirect('tooltraq://auth/callback', S))
      .toThrow(expect.objectContaining({ reason: 'missing_code' }));
  });
});

describe('signInWithGoogle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('completes the round trip and returns the token response', async () => {
    mockedAuthorize.mockResolvedValueOnce({ authorization_url: 'https://workos.example/authz' });
    // state is deterministic because getRandomBytesAsync is mocked to 0xab bytes
    const state = 'ab'.repeat(16);
    mockedOpen.mockResolvedValueOnce({
      type: 'success',
      url: `tooltraq://auth/callback?code=ok&state=${state}`,
    });
    const tokens = { access_token: 'a', refresh_token: 'r', expires_in: 1, user: { id: 1 } };
    mockedCallback.mockResolvedValueOnce(tokens);

    const res = await signInWithGoogle('sign-up');

    expect(mockedAuthorize).toHaveBeenCalledWith({
      provider: 'GoogleOAuth',
      state,
      screen_hint: 'sign-up',
    });
    expect(mockedOpen).toHaveBeenCalledWith('https://workos.example/authz', REDIRECT_URI);
    expect(mockedCallback).toHaveBeenCalledWith('ok');
    expect(res).toEqual(tokens);
  });

  it('returns null when the user cancels the browser', async () => {
    mockedAuthorize.mockResolvedValueOnce({ authorization_url: 'https://x' });
    mockedOpen.mockResolvedValueOnce({ type: 'cancel' });
    expect(await signInWithGoogle('sign-in')).toBeNull();
    expect(mockedCallback).not.toHaveBeenCalled();
  });

  it('returns null when the provider redirect carries an error param (user denied)', async () => {
    mockedAuthorize.mockResolvedValueOnce({ authorization_url: 'https://x' });
    mockedOpen.mockResolvedValueOnce({
      type: 'success',
      url: 'tooltraq://auth/callback?error=access_denied&state=' + 'ab'.repeat(16),
    });
    expect(await signInWithGoogle('sign-in')).toBeNull();
    expect(mockedCallback).not.toHaveBeenCalled();
  });

  it('throws on state mismatch and never calls the callback endpoint', async () => {
    mockedAuthorize.mockResolvedValueOnce({ authorization_url: 'https://x' });
    mockedOpen.mockResolvedValueOnce({
      type: 'success',
      url: 'tooltraq://auth/callback?code=c&state=evil',
    });
    await expect(signInWithGoogle('sign-in')).rejects.toMatchObject({ reason: 'state_mismatch' });
    expect(mockedCallback).not.toHaveBeenCalled();
  });
});

describe('googleSignInAlert', () => {
  // ApiError uses a shape-object constructor; a backend 503 arrives as
  // code 'server' + status 503, and the backend's 401 oauth_failed arrives
  // as code 'unauthorized' + status 401 (fromAxiosError maps by HTTP status).
  it('maps a 503 (backend not configured) to the not-available message', () => {
    const err = new ApiError({ code: 'server', status: 503, message: 'Google sign-in is not configured.' });
    expect(googleSignInAlert(err)).toEqual({
      title: 'Google sign-in unavailable',
      message: "Google sign-in isn't available yet. Please use email and password.",
    });
  });
  it('maps OAuthRedirectError to the generic retry message', () => {
    expect(googleSignInAlert(new OAuthRedirectError('state_mismatch'))).toEqual({
      title: 'Google sign-in failed',
      message: 'Google sign-in failed. Please try again.',
    });
  });
  it('shows the server message for a 401 oauth_failed (NOT swallowed as session-expiry)', () => {
    const err = new ApiError({ code: 'unauthorized', status: 401, message: 'Google sign-in could not be completed.' });
    expect(googleSignInAlert(err)).toEqual({
      title: 'Google sign-in failed',
      message: 'Google sign-in could not be completed.',
    });
  });
  it('uses the error message for other ApiErrors (e.g. network)', () => {
    const err = new ApiError({ code: 'network', message: 'Network error — check your connection.' });
    expect(googleSignInAlert(err)).toEqual({
      title: 'Google sign-in failed',
      message: 'Network error — check your connection.',
    });
  });
});
```

**Why `unauthorized` is NOT skipped here (unlike the rest of the app):** the OAuth endpoints are unauthenticated (`auth=None` on the backend) and Task 1 excludes them from the refresh interceptor, so a 401 from them is a sign-in failure the user must see — there is no session to expire and no global handler involved. Also check `jest.setup.js`: if `expo-crypto`/`expo-web-browser` already have global mocks, the per-file `jest.mock` calls above override them harmlessly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/unit/googleSignIn.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: FAIL — cannot find module `../../auth/googleSignIn`.

- [ ] **Step 3: Implement `src/auth/googleSignIn.ts`**

```ts
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { oauthAuthorize, oauthCallback } from '../api/endpoints/auth';
import { ApiError } from '../api/errors';
import type { TokenResponse } from '../api/types';

export const REDIRECT_URI = 'tooltraq://auth/callback';

export type OAuthRedirectFailure = 'state_mismatch' | 'missing_code' | 'provider_error';

export class OAuthRedirectError extends Error {
  reason: OAuthRedirectFailure;
  constructor(reason: OAuthRedirectFailure) {
    super(`oauth_redirect_${reason}`);
    this.name = 'OAuthRedirectError';
    this.reason = reason;
  }
}

// React Native's URL polyfill throws on .searchParams (Node's URL in Jest
// hides this), so parse the query string by hand.
function queryParams(url: string): Record<string, string> {
  const query = url.split('#')[0].split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split('=');
    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join('=') || '');
    } catch {
      // Skip malformed percent-encoding rather than crash the flow.
    }
  }
  return out;
}

export function parseOAuthRedirect(
  url: string,
  expectedState: string
): { code: string } {
  const params = queryParams(url);
  if (params.error) throw new OAuthRedirectError('provider_error');
  if (params.state !== expectedState) throw new OAuthRedirectError('state_mismatch');
  if (!params.code) throw new OAuthRedirectError('missing_code');
  return { code: params.code };
}

async function randomState(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Full native Google OAuth round trip.
 * Returns null when the user cancels/dismisses the browser or denies consent.
 * Throws OAuthRedirectError (state mismatch / malformed redirect) or ApiError.
 */
export async function signInWithGoogle(
  screenHint: 'sign-in' | 'sign-up'
): Promise<TokenResponse | null> {
  const state = await randomState();
  const { authorization_url } = await oauthAuthorize({
    provider: 'GoogleOAuth',
    state,
    screen_hint: screenHint,
  });

  const result = await WebBrowser.openAuthSessionAsync(authorization_url, REDIRECT_URI);
  if (result.type !== 'success') return null; // cancel | dismiss | locked

  let code: string;
  try {
    ({ code } = parseOAuthRedirect(result.url, state));
  } catch (err) {
    if (err instanceof OAuthRedirectError && err.reason === 'provider_error') {
      return null; // user denied consent at Google — treat like cancel
    }
    throw err;
  }
  return oauthCallback(code);
}

/**
 * Maps a signInWithGoogle failure to alert copy.
 * Note: unlike the rest of the app, a 401 ('unauthorized') from the OAuth
 * endpoints is shown, not skipped — they are unauthenticated endpoints
 * (excluded from the refresh interceptor), so 401 means oauth_failed,
 * not an expired session.
 */
export function googleSignInAlert(
  err: unknown
): { title: string; message: string } {
  if (err instanceof OAuthRedirectError) {
    return {
      title: 'Google sign-in failed',
      message: 'Google sign-in failed. Please try again.',
    };
  }
  if (err instanceof ApiError) {
    if (err.status === 503) {
      return {
        title: 'Google sign-in unavailable',
        message: "Google sign-in isn't available yet. Please use email and password.",
      };
    }
    return {
      title: 'Google sign-in failed',
      message: err.message || 'Google sign-in could not be completed.',
    };
  }
  return {
    title: 'Google sign-in failed',
    message: 'Google sign-in failed. Please try again.',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tests/unit/googleSignIn.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/googleSignIn.ts src/tests/unit/googleSignIn.test.ts
git commit -m "feat(auth): Google sign-in orchestrator with strict state verification"
```

---

### Task 3: AuthContext action, button component, screen wiring

**Files:**
- Modify: `src/auth/AuthContext.tsx` (interface ~line 35-50; actions near `login` ~line 111)
- Create: `src/components/GoogleSignInButton.tsx`
- Modify: `src/screens/AuthScreens/Login/LoginScreen.tsx` (below the Sign In button, lines 417-424)
- Modify: `src/screens/AuthScreens/Register/RegisterScreen.tsx` (below the Register button, lines 226-233)

**Interfaces:**
- Consumes: `signInWithGoogle`, `googleSignInAlert` from Task 2.
- Produces: `loginWithGoogle: (screenHint: 'sign-in' | 'sign-up') => Promise<UserMe | null>` on `AuthContextValue`; `<GoogleSignInButton onPress loading disabled? />` component.

- [ ] **Step 1: AuthContext**

Add to the `AuthContextValue` interface (next to `login`):

```ts
  loginWithGoogle: (screenHint: 'sign-in' | 'sign-up') => Promise<UserMe | null>;
```

Add the import and action (next to the existing `login` callback):

```ts
import { signInWithGoogle } from './googleSignIn';
```

```ts
  const loginWithGoogle = useCallback(
    async (screenHint: 'sign-in' | 'sign-up') => {
      const response = await signInWithGoogle(screenHint);
      if (!response) return null; // user cancelled
      applyUser(response.user);
      return response.user;
    },
    [applyUser]
  );
```

Add `loginWithGoogle` to the context value object (wherever `login` is listed).

- [ ] **Step 2: GoogleSignInButton component**

```tsx
// src/components/GoogleSignInButton.tsx
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const GoogleSignInButton: React.FC<Props> = ({ onPress, loading, disabled }) => {
  const { colors } = useTheme();
  const blocked = loading || disabled;
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.surface, borderColor: colors.borderInput },
        blocked && styles.blocked,
      ]}
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      testID="google-signin-button"
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <>
          <Ionicons name="logo-google" size={18} color={colors.textPrimary} style={styles.icon} />
          <Text style={[styles.label, { color: colors.textPrimary }]}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  blocked: { opacity: 0.6 },
  icon: { marginRight: 10 },
  label: { fontSize: 16, fontWeight: '600' },
});

export default GoogleSignInButton;
```

**NOTE:** confirm `colors.surface`/`colors.borderInput` exist in BOTH palettes in `src/context/ThemeContext.js` (LoginScreen already uses `colors.borderInput`, so it exists; verify `surface` — if missing, use the background-card color the theme actually defines, e.g. `colors.surfaceAlt`).

- [ ] **Step 3: Wire into LoginScreen**

Imports: add `GoogleSignInButton` and `googleSignInAlert`:

```tsx
import GoogleSignInButton from '../../../components/GoogleSignInButton';
import { googleSignInAlert } from '../../../auth/googleSignIn';
```

Get `loginWithGoogle` from the same `useAuth()` destructuring the screen already uses for `login`, add local state `const [googleLoading, setGoogleLoading] = useState(false);`, and a handler next to `handleLogin`:

```tsx
  const handleGoogleSignIn = async (): Promise<void> => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle('sign-in');
      // Success or cancel: navigation falls out of auth state; nothing to do.
    } catch (err) {
      const alert = googleSignInAlert(err);
      Alert.alert(alert.title, alert.message);
    } finally {
      setGoogleLoading(false);
    }
  };
```

(`Alert` is imported from `react-native`; add it to the existing import if absent.)

Render below the Sign In `<Button …testID="login-button" />` (line 424), above the Forgot Password link:

```tsx
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
                <Text style={{ color: colors.textSecondary, marginHorizontal: 10, fontSize: 13 }}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
              </View>
              <GoogleSignInButton onPress={handleGoogleSignIn} loading={googleLoading} disabled={isLoading} />
```

Add to the screen's StyleSheet:

```tsx
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
```

- [ ] **Step 4: Wire into RegisterScreen**

Same pattern: imports, `loginWithGoogle` from `useAuth()`, `googleLoading` state, handler calling `loginWithGoogle('sign-up')` (identical body to LoginScreen's, including the `googleSignInAlert` alert mapping), divider + `<GoogleSignInButton onPress={handleGoogleSignIn} loading={googleLoading} disabled={isSubmitting} />` rendered below the Register `<Button />` (line 233), above the "Already have an account?" row. Add the same `dividerRow`/`dividerLine` styles to this screen's StyleSheet. Note: a successful Google **sign-up** yields tokens immediately (no email-verification step) — `applyUser` flips auth state and navigation leaves the Register screen automatically; do not navigate manually.

- [ ] **Step 5: Verify full baseline**

Run: `npx jest --testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\."`
Expected: exactly the 7 known failing suites, no others.

- [ ] **Step 6: Commit**

```bash
git add src/auth/AuthContext.tsx src/components/GoogleSignInButton.tsx \
  src/screens/AuthScreens/Login/LoginScreen.tsx src/screens/AuthScreens/Register/RegisterScreen.tsx
git commit -m "feat(auth): Continue with Google on Login and Register screens"
```

---

### Task 4: Verification + draft PR

**Files:** none new (verification only — changelog is bumped at ship time, not now, per spec).

- [ ] **Step 1: Full test run + diff hygiene**

Run: `npx jest --testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\."` → exactly 7 known failing suites.
Run: `git status --short` → the ONLY modified-unstaged files are `docs/api/openapi.json` and `src/api/generated/schema.ts` (user-owned; untouched).

- [ ] **Step 2: Push + draft PR**

```bash
git push -u origin feat/google-signin-mobile
gh pr create --draft --title "feat: Google sign-in/sign-up (blocked on backend OAuth deploy)" \
  --body "$(cat <<'EOF'
## Summary
- "Continue with Google" on Login (sign-in hint) and Register (sign-up hint)
- Native OAuth flow: /auth/oauth/authorize/ → system browser → tooltraq://auth/callback deep link → strict state verification → /auth/oauth/callback/ → existing token persistence; new users land in onboarding automatically
- Safe pre-deploy: backend 503 shows "Google sign-in isn't available yet"
- JS-only; expo-web-browser, expo-crypto, and the tooltraq scheme are already in deployed native builds → Android OTA-ready

## Blocked on (backend)
- Deploy feat/mobile-google-signup-onboarding
- Set WORKOS_API_OAUTH_REDIRECT_URI=tooltraq://auth/callback
- Register the redirect URI in the WorkOS dashboard

## Release constraint
Android OTA channel only until Apple sign-in exists (App Store guideline 4.8).

Spec: docs/superpowers/specs/2026-07-03-google-signin-mobile-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Report** — remaining human steps: backend deploy + env + WorkOS dashboard, on-device Android round-trip test, then mark PR ready + changelog bump + OTA.
