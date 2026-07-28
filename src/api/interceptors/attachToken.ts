import type { InternalAxiosRequestConfig } from 'axios';
import { getCached, hydrate } from '../tokenStore';
import { refreshOnce } from './refreshOn401';

// Refresh ahead of expiry so a request never has to pay the
// fail-401 → refresh → retry triple round trip.
const EXPIRY_SKEW_MS = 60_000;

const ANONYMOUS_PATHS = [
  '/auth/login/',
  '/auth/register/',
  '/auth/verify-email/',
  '/auth/password/forgot/',
  '/auth/password/reset/',
  '/auth/token/refresh/',
  '/auth/oauth/', // authorize + callback are anonymous; a stale bearer here could 401 the flow
  '/invitations/accept/',
  '/invitations/by-token/',
];

function isAnonymous(url: string | undefined): boolean {
  if (!url) return false;
  return ANONYMOUS_PATHS.some((path) => url.includes(path));
}

function tokenFingerprint(token: string): string {
  // First 8 + last 4 chars so we can tell tokens apart without leaking them.
  if (token.length <= 16) return `len=${token.length}`;
  return `${token.slice(0, 8)}…${token.slice(-4)} len=${token.length}`;
}

export async function attachToken(
  config: InternalAxiosRequestConfig
): Promise<InternalAxiosRequestConfig> {
  if (isAnonymous(config.url)) {
    console.log(`[api.auth] anonymous ${config.url ?? ''} — no bearer attached`);
    return config;
  }
  const tokens = getCached() ?? (await hydrate());
  if (tokens?.accessToken) {
    let accessToken = tokens.accessToken;
    const expiresAt = tokens.expiresAt;
    if (expiresAt !== null && expiresAt - Date.now() < EXPIRY_SKEW_MS) {
      console.log(`[api.auth] token near/at expiry — refreshing before ${config.url ?? ''}`);
      // null = transient refresh failure; send the cached token anyway and
      // let the refresh-on-401 interceptor handle it if the server rejects.
      accessToken = (await refreshOnce()) ?? accessToken;
    }
    config.headers.set('Authorization', `Bearer ${accessToken}`);
    console.log(
      `[api.auth] bearer attached to ${config.url ?? ''} (${tokenFingerprint(accessToken)})`
    );
  } else {
    console.log(`[api.auth] no token available for ${config.url ?? ''}`);
  }
  return config;
}
