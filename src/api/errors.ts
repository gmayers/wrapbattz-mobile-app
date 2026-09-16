import type { AxiosError } from 'axios';

export type ApiErrorCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'server'
  | 'unknown';

export interface ApiErrorShape {
  code: ApiErrorCode;
  status?: number;
  message: string;
  detail?: unknown;
}

export class ApiError extends Error implements ApiErrorShape {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly detail?: unknown;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.code = shape.code;
    this.status = shape.status;
    this.detail = shape.detail;
  }
}

export function fromAxiosError(error: AxiosError): ApiError {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiError({ code: 'timeout', message: 'Request timed out.' });
  }

  if (!error.response) {
    return new ApiError({ code: 'network', message: 'Network error — check your connection.' });
  }

  const { status, data } = error.response;
  const detail = data;
  const message = extractMessage(data) ?? error.message ?? 'Request failed.';

  if (status === 401) return new ApiError({ code: 'unauthorized', status, message, detail });
  if (status === 403) return new ApiError({ code: 'forbidden', status, message, detail });
  if (status === 404) return new ApiError({ code: 'not_found', status, message, detail });
  if (status === 409) return new ApiError({ code: 'conflict', status, message, detail });
  if (status === 422 || status === 400) {
    return new ApiError({ code: 'validation', status, message, detail });
  }
  if (status >= 500) return new ApiError({ code: 'server', status, message, detail });
  return new ApiError({ code: 'unknown', status, message, detail });
}

export interface NormalizedFormError {
  /** Field name → message, keyed to match form field names (never envelope keys). */
  fieldErrors: Record<string, string>;
  /** Human-readable summary. Always non-empty. */
  message: string;
}

// Envelope keys the API wraps every error body in. They are never form fields,
// so mapping them onto a form silently swallows the error.
const ENVELOPE_KEYS = new Set(['code', 'message', 'errors', 'detail', 'status']);

function firstMessage(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

/**
 * Split an API error into per-field messages and a summary.
 *
 * Handles both shapes the backend emits:
 *   django-ninja  {code, message, errors: {"payload.password": ["…"]}}
 *   DRF-style     {email: ["…"]}
 *
 * Callers should render `fieldErrors` inline and fall back to `message` when a
 * key doesn't match any field on screen — otherwise the error goes unseen and
 * the submit button looks broken.
 */
export function normalizeFormError(error: unknown, fallbackMessage: string): NormalizedFormError {
  const fieldErrors: Record<string, string> = {};
  const apiError = error instanceof ApiError ? error : undefined;
  const detail = apiError?.detail;

  if (detail && typeof detail === 'object') {
    const body = detail as Record<string, unknown>;

    // django-ninja nests field errors under `errors`, prefixed with the
    // parameter name ("payload.password", "body.email").
    const nested = body.errors;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const [key, value] of Object.entries(nested as Record<string, unknown>)) {
        const field = key.slice(key.lastIndexOf('.') + 1);
        const message = firstMessage(value);
        if (field && message) fieldErrors[field] = message;
      }
    }

    // DRF-style bodies put field errors at the top level.
    for (const [key, value] of Object.entries(body)) {
      if (ENVELOPE_KEYS.has(key) || fieldErrors[key]) continue;
      const message = firstMessage(value);
      if (message) fieldErrors[key] = message;
    }
  }

  const message =
    (typeof (detail as Record<string, unknown> | undefined)?.message === 'string'
      ? String((detail as Record<string, unknown>).message)
      : undefined) ??
    (apiError?.message || undefined) ??
    ((error as { message?: string } | undefined)?.message || undefined) ??
    fallbackMessage;

  return { fieldErrors, message: message || fallbackMessage };
}

function extractMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === 'string') return obj.detail;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  return undefined;
}
