import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';
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
];

let inFlight: Promise<string | null> | null = null;

async function runRefresh(): Promise<string | null> {
  const tokens = getCached();
  if (!tokens?.refreshToken) return null;
  try {
    const { data } = await axios.post<TokenResponse>(
      `${API_BASE_URL}/auth/token/refresh/`,
      { refresh_token: tokens.refreshToken },
      { timeout: 15_000 }
    );
    await save({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: data.expires_in,
    });
    emit('tokens-updated', undefined);
    return data.access_token;
  } catch {
    await clear();
    emit('tokens-cleared', undefined);
    emit('session-expired', undefined);
    return null;
  }
}

function refreshOnce(): Promise<string | null> {
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
      if (status !== 401 || !original || original._retried) {
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
