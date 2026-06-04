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

type RetryConfig = InternalAxiosRequestConfig & { __retryCount?: number };

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 400; // 400ms, then 800ms

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

      if (!isIdempotent(cfg.method) || !isTransient(error)) {
        return Promise.reject(error);
      }

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
