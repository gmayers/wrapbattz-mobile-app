import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// Transient-failure retry for idempotent reads.
//
// The app fans out several parallel GETs on most screens (dashboards, lists).
// When the backend hiccups — a brief 5xx, a 429, or a dropped/slow connection —
// a single blip surfaces a "Network error" alert even though an immediate retry
// usually succeeds (users learned to "try again 2-3 times"). This interceptor
// retries those transient failures automatically, with backoff, so the blip
// never reaches the UI.
//
// Scope is deliberately narrow:
//   - GET/HEAD/OPTIONS only. POST/PUT/PATCH/DELETE are NOT retried — re-sending
//     a create/assign/transfer could double-apply it. (Those "tool already has
//     an active assignment" errors are real 4xx and must surface, not retry.)
//   - Only transient conditions: no response (network/timeout), 5xx, or 429.
//     4xx (validation, conflict, not-found, forbidden) are real and surface.
//   - 401 is explicitly skipped — the refresh interceptor owns that path.

declare module 'axios' {
  export interface AxiosRequestConfig {
    // Opt a request out of transient retries. Used by calls with their own
    // fail-fast contract (e.g. splash-screen bootstrap must surface an error
    // in one timeout, not timeout × attempts).
    noTransientRetry?: boolean;
  }
}

type RetryConfig = InternalAxiosRequestConfig & {
  __retryCount?: number;
  __firstFailureAt?: number;
};

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 400; // 400ms, then 800ms
// Retries may only be STARTED within this window after the first failure.
// A hung connection consumes its full timeout per attempt; without this cap
// the user waits timeout × 3 (+ backoff) before seeing any error.
const RETRY_BUDGET_MS = 8_000;

function isIdempotent(method?: string): boolean {
  const m = (method ?? 'get').toLowerCase();
  return m === 'get' || m === 'head' || m === 'options';
}

function isTransient(error: AxiosError): boolean {
  // No response object → network error or timeout (ECONNABORTED).
  if (!error.response) return true;
  const status = error.response.status;
  return status >= 500 || status === 429;
}

export function installRetryOnTransient(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const cfg = error.config as RetryConfig | undefined;
      if (!cfg) return Promise.reject(error);

      // 401 is the refresh interceptor's job — never retry it here.
      if (error.response?.status === 401) return Promise.reject(error);

      if (cfg.noTransientRetry || !isIdempotent(cfg.method) || !isTransient(error)) {
        return Promise.reject(error);
      }

      const now = Date.now();
      cfg.__firstFailureAt ??= now;
      if (now - cfg.__firstFailureAt >= RETRY_BUDGET_MS) return Promise.reject(error);

      const attempt = cfg.__retryCount ?? 0;
      if (attempt >= MAX_RETRIES) return Promise.reject(error);
      cfg.__retryCount = attempt + 1;

      const delay = BASE_DELAY_MS * 2 ** attempt;
      const method = (cfg.method ?? 'get').toUpperCase();
      console.log(
        `[api] ↻ retry ${cfg.__retryCount}/${MAX_RETRIES} after ${delay}ms — ${method} ${cfg.url}`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return client.request(cfg);
    }
  );
}
