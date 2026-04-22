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
  if (error.code === 'ECONNABORTED') {
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

function extractMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === 'string') return obj.detail;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  return undefined;
}
