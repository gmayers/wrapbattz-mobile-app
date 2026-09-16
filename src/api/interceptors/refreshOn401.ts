import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config';
import { emit } from '../events';
import { clear, getCached, save } from '../tokenStore';
import type { TokenResponse } from '../types';

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const NON_REFRESHABLE_PATHS = [
  '/auth/login/',
  '/auth/register/',
  '/auth/verify-email/',
  '/auth/password/forgot/',
  '/auth/password/reset/',
  '/auth/token/refresh/',
  '/auth/oauth/', // authorize + callback are auth=None; a 401 here is oauth_failed, not an expired session
];

let inFlight: Promise<string | null> | null = null;

async function runRefresh(): Promise<string | null> {
  const tokens = getCached();
  if (!tokens?.refreshToken) {
    console.log('[api.refresh] no refresh token in store — cannot refresh');
    return null;
  }
  console.log('[api.refresh] requesting new tokens');
  try {
    const { data } = await axios.post<TokenResponse>(
      `${API_BASE_URL}/auth/token/refresh/`,
      { refresh_token: tokens.refreshToken },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    await save({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: data.expires_in,
    });
    console.log('[api.refresh] tokens refreshed and saved');
    emit('tokens-updated', undefined);
    return data.access_token;
  } catch (error) {
    // Only a rejected refresh token ends the session. Timeouts, network
    // failures and 5xx/429 are transient — WorkOS having a slow moment must
    // not sign the user out (refresh tokens stay valid; we just try again
    // on the next 401).
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const terminal = status === 400 || status === 401 || status === 403;
    if (!terminal) {
      console.log(
        `[api.refresh] transient refresh failure (status=${status ?? 'none'}) — keeping tokens`,
        error
      );
      return null;
    }
    console.log('[api.refresh] refresh token rejected — clearing session', error);
    await clear();
    emit('tokens-cleared', undefined);
    emit('session-expired', undefined);
    return null;
  }
}

export function refreshOnce(): Promise<string | null> {
  if (!inFlight) {
    inFlight = runRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function installRefreshOn401(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as RetryConfig | undefined;
      const status = error.response?.status;
      // 403 organization_required means the access token is user-scoped but the
      // endpoint needs org scope (e.g. right after onboarding creates the org).
      // The refresh endpoint upgrades single-membership users to an org-scoped
      // token, so refresh-and-retry heals this the same way it heals a 401.
      const needsOrgScope =
        status === 403 &&
        (error.response?.data as { code?: string } | null)?.code === 'organization_required';
      if ((status !== 401 && !needsOrgScope) || !original || original._retried) {
        return Promise.reject(error);
      }
      if (NON_REFRESHABLE_PATHS.some((p) => original.url?.includes(p))) {
        return Promise.reject(error);
      }

      original._retried = true;
      const newToken = await refreshOnce();
      if (!newToken) {
        return Promise.reject(error);
      }
      original.headers.set('Authorization', `Bearer ${newToken}`);
      return client.request(original);
    }
  );
}
