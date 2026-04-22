import type { InternalAxiosRequestConfig } from 'axios';
import { getCached, hydrate } from '../tokenStore';

const ANONYMOUS_PATHS = [
  '/auth/login/',
  '/auth/register/',
  '/auth/verify-email/',
  '/auth/password/forgot/',
  '/auth/password/reset/',
  '/auth/token/refresh/',
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
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    console.log(
      `[api.auth] bearer attached to ${config.url ?? ''} (${tokenFingerprint(tokens.accessToken)})`
    );
  } else {
    console.log(`[api.auth] no token available for ${config.url ?? ''}`);
  }
  return config;
}
