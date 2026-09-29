import { billingErrorMessage, isBillingForbidden, isBillingUnavailable } from '../billingErrors';
import { ApiError } from '../errors';

const err = (shape: ConstructorParameters<typeof ApiError>[0]) => new ApiError(shape);

describe('isBillingUnavailable', () => {
  // These are the cases the screens must render as an empty state. Before the
  // fix they were checked via `error.response.status`, which apiClient never
  // sets, so every one of them fell through to an error alert.
  it.each([
    ['404 not found', { code: 'not_found' as const, status: 404, message: 'x' }],
    ['offline', { code: 'network' as const, message: 'x' }],
    ['timeout', { code: 'timeout' as const, message: 'x' }],
  ])('treats %s as unavailable', (_label, shape) => {
    expect(isBillingUnavailable(err(shape))).toBe(true);
  });

  it('treats a 501 stub endpoint as unavailable', () => {
    expect(isBillingUnavailable(err({ code: 'unknown', status: 501, message: 'x' }))).toBe(true);
  });

  it('treats the billing_disabled switch as unavailable', () => {
    const e = err({
      code: 'unknown',
      status: 400,
      message: 'x',
      detail: { code: 'billing_disabled', message: 'Billing is not enabled.' },
    });
    expect(isBillingUnavailable(e)).toBe(true);
  });

  it('does not hide real failures', () => {
    expect(isBillingUnavailable(err({ code: 'server', status: 500, message: 'x' }))).toBe(false);
    expect(isBillingUnavailable(err({ code: 'forbidden', status: 403, message: 'x' }))).toBe(false);
  });

  it('ignores non-ApiError values', () => {
    expect(isBillingUnavailable(new Error('boom'))).toBe(false);
    expect(isBillingUnavailable(undefined)).toBe(false);
  });
});

describe('isBillingForbidden', () => {
  it('detects the owner-only routes rejecting a non-owner', () => {
    expect(isBillingForbidden(err({ code: 'forbidden', status: 403, message: 'x' }))).toBe(true);
    expect(isBillingForbidden(err({ code: 'server', status: 500, message: 'x' }))).toBe(false);
  });
});

describe('billingErrorMessage', () => {
  it('explains an owner-only rejection', () => {
    expect(billingErrorMessage(err({ code: 'forbidden', status: 403, message: 'x' }), 'fb')).toBe(
      'Only the organisation owner can manage billing.'
    );
  });

  it('prefers the server message, which names the real reason', () => {
    const e = err({
      code: 'conflict',
      status: 409,
      message: 'generic',
      detail: { code: 'subscription_conflict', message: 'Cancel it before subscribing.' },
    });
    expect(billingErrorMessage(e, 'fb')).toBe('Cancel it before subscribing.');
  });

  it.each([
    ['network' as const, 'No connection. Check your network and try again.'],
    ['timeout' as const, 'The request timed out. Please try again.'],
    ['unauthorized' as const, 'Your session has expired. Please sign in again.'],
    ['server' as const, 'Billing is temporarily unavailable. Please try again shortly.'],
  ])('maps %s to its own copy', (code, expected) => {
    expect(billingErrorMessage(err({ code, message: 'x' }), 'fb')).toBe(expected);
  });

  it('falls back when the value is not an ApiError', () => {
    expect(billingErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
  });
});
