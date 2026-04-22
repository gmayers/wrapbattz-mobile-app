import axios, { type AxiosInstance } from 'axios';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import { fromAxiosError } from './errors';
import { attachToken } from './interceptors/attachToken';
import { installRefreshOn401 } from './interceptors/refreshOn401';

declare const __DEV__: boolean;

function fullUrl(baseURL: string | undefined, url: string | undefined): string {
  if (!url) return baseURL ?? '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = baseURL?.replace(/\/$/, '') ?? '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function create(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use((config) => {
    if (__DEV__) {
      const method = (config.method ?? 'get').toUpperCase();
      const url = fullUrl(config.baseURL, config.url);
      console.log(`[api] → ${method} ${url}`);
    }
    return config;
  });
  instance.interceptors.request.use(attachToken);
  installRefreshOn401(instance);

  instance.interceptors.response.use(
    (response) => {
      if (__DEV__) {
        const method = (response.config.method ?? 'get').toUpperCase();
        const url = fullUrl(response.config.baseURL, response.config.url);
        console.log(`[api] ← ${response.status} ${method} ${url}`);
      }
      return response;
    },
    (error) => {
      if (__DEV__) {
        const cfg = error.config ?? {};
        const method = (cfg.method ?? 'get').toUpperCase();
        const url = fullUrl(cfg.baseURL, cfg.url);
        const status = error.response?.status ?? 'no-response';
        console.log(`[api] ✕ ${status} ${method} ${url} — ${error.message}`);
      }
      return Promise.reject(fromAxiosError(error));
    }
  );

  return instance;
}

export const apiClient: AxiosInstance = create();
