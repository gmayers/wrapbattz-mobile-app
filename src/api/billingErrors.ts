import { ApiError } from './errors';

/**
 * Billing error classification.
 *
 * These helpers exist because the billing screens were written against axios
 * errors (`error.response.status`) while `apiClient` rejects with `ApiError`,
 * which has no `.response`. Every "billing isn't set up yet, show an empty
 * state" branch therefore never matched and users saw raw "Server error"
 * alerts instead. Route billing failures through here rather than reading
 * `.response` or `.status` at the call site.
 */

/** The error code the backend returns when the billing_enabled switch is off. */
const BILLING_DISABLED = 'billing_disabled';

function detailCode(error: ApiError): string | undefined {
  const detail = error.detail;
  if (detail && typeof detail === 'object' && typeof (detail as { code?: unknown }).code === 'string') {
    return (detail as { code: string }).code;
  }
  return undefined;
}

/**
 * True when billing simply isn't reachable for this org — the routes aren't
 * deployed, the `billing_enabled` switch is off, the org has no subscription
 * row yet, or the device is offline.
 *
 * Callers should render a neutral "not set up" / "unavailable" state for
 * these. They are expected conditions, not failures worth alerting about.
 */
export function isBillingUnavailable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'not_found') return true;
  if (error.code === 'network' || error.code === 'timeout') return true;
  // 501: endpoint exists but is a deliberate stub (credits redemption).
  if (error.status === 501) return true;
  return detailCode(error) === BILLING_DISABLED;
}

/** True when the route exists but this user's role can't use it. */
export function isBillingForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'forbidden';
}

/**
 * User-facing copy for a billing failure that is worth showing. Prefers the
 * server's own message, which carries the specific reason (plan_not_found,
 * subscription_conflict, no_payment_method, …).
 */
export function billingErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  if (isBillingForbidden(error)) {
    return 'Only the organisation owner can manage billing.';
  }
  if (error.code === 'unauthorized') {
    return 'Your session has expired. Please sign in again.';
  }
  if (error.code === 'network') {
    return 'No connection. Check your network and try again.';
  }
  if (error.code === 'timeout') {
    return 'The request timed out. Please try again.';
  }
  if (error.code === 'server') {
    return 'Billing is temporarily unavailable. Please try again shortly.';
  }

  const detail = error.detail;
  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error.message?.trim() || fallback;
}
