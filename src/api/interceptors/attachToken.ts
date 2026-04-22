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

export async function attachToken(
  config: InternalAxiosRequestConfig
): Promise<InternalAxiosRequestConfig> {
  if (isAnonymous(config.url)) return config;
  const tokens = getCached() ?? (await hydrate());
  if (tokens?.accessToken) {
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  return config;
}
