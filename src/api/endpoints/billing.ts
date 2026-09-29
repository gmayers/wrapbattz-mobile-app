import { apiClient } from '../client';
import { ApiError } from '../errors';
import type {
  AddonResult,
  BillingState,
  CatalogResponse,
  CheckoutRequest,
  CheckoutResponse,
  CustomerSheetResponse,
  DefaultPaymentMethodRequest,
  IapRestoreRequest,
  IapVerifyRequest,
  Invoice,
  PlansResponse,
  PortalResponse,
  SubscriptionState,
} from '../types-billing';

// ── Mobile IAP contract ───────────────────────────────────────────
// These four paths carry no trailing slash: the backend registers them
// slash-less on purpose, because Django's APPEND_SLASH redirect drops
// POST bodies. Do not "tidy" a slash onto them.

export async function getCatalog(): Promise<CatalogResponse> {
  const { data } = await apiClient.get<CatalogResponse>('/billing/catalog');
  return data;
}

export async function getSubscription(): Promise<SubscriptionState> {
  const { data } = await apiClient.get<SubscriptionState>('/billing/subscription');
  return data;
}

export async function iapVerify(payload: IapVerifyRequest): Promise<SubscriptionState> {
  const { data } = await apiClient.post<SubscriptionState>('/billing/iap/verify', payload);
  return data;
}

export async function iapRestore(payload: IapRestoreRequest): Promise<SubscriptionState> {
  const { data } = await apiClient.post<SubscriptionState>('/billing/iap/restore', payload);
  return data;
}

// ── Billing state, plans, invoices ────────────────────────────────

/** The org's full billing picture. Ungated: answers even with billing off. */
export async function getBillingState(): Promise<BillingState> {
  const { data } = await apiClient.get<BillingState>('/billing/');
  return data;
}

/**
 * Public — the only billing route that needs no bearer token.
 *
 * The server keys add-ons by singular kind ("seat", "device") while every
 * screen reads "seats"/"devices", so normalise here once.
 */
export async function getPlans(): Promise<PlansResponse> {
  const { data } = await apiClient.get<PlansResponse>('/billing/plans/');
  const addons = { ...(data.addons ?? {}) };
  if (addons.seat && !addons.seats) addons.seats = addons.seat;
  if (addons.device && !addons.devices) addons.devices = addons.device;
  return { ...data, addons };
}

/** Flat array, not a paginated envelope. */
export async function getInvoices(): Promise<Invoice[]> {
  const { data } = await apiClient.get<Invoice[]>('/billing/invoices/');
  return Array.isArray(data) ? data : [];
}

// ── Stripe checkout / portal / payment methods ────────────────────

/** Owner-only. Returns the PaymentSheet params for a new subscription. */
export async function startCheckout(payload: CheckoutRequest): Promise<CheckoutResponse> {
  const { data } = await apiClient.post<CheckoutResponse>('/billing/checkout/', payload);
  return data;
}

export async function openPortal(): Promise<PortalResponse> {
  const { data } = await apiClient.post<PortalResponse>('/billing/portal/');
  return data;
}

export async function createCustomerSheet(): Promise<CustomerSheetResponse> {
  const { data } = await apiClient.post<CustomerSheetResponse>('/billing/customer-sheet/');
  return data;
}

export async function setDefaultPaymentMethod(
  payload: DefaultPaymentMethodRequest
): Promise<void> {
  await apiClient.post('/billing/payment-method/default/', payload);
}

// ── Subscription actions ──────────────────────────────────────────
// Both return the refreshed BillingState, so callers can drop their
// own follow-up refetch.

export async function cancelSubscription(): Promise<BillingState> {
  const { data } = await apiClient.post<BillingState>('/billing/subscription/cancel/');
  return data;
}

export async function resumeSubscription(): Promise<BillingState> {
  const { data } = await apiClient.post<BillingState>('/billing/subscription/resume/');
  return data;
}

// ── Add-ons ───────────────────────────────────────────────────────

/**
 * The backend answers 402 with a normal AddonResult body when the org has no
 * payment method on file. The axios interceptor turns any 402 into an
 * ApiError, so unwrap that case back into a result rather than letting an
 * "out of credit" answer surface as a crash.
 */
function unwrapAddonResult(error: unknown): AddonResult {
  if (error instanceof ApiError && error.status === 402 && isAddonResult(error.detail)) {
    return error.detail;
  }
  throw error;
}

function isAddonResult(detail: unknown): detail is AddonResult {
  return typeof detail === 'object' && detail !== null && 'ok' in detail && 'granted' in detail;
}

export async function buySeats(seats: number): Promise<AddonResult> {
  try {
    const { data } = await apiClient.post<AddonResult>('/billing/add-ons/seats/', { seats });
    return data;
  } catch (error) {
    return unwrapAddonResult(error);
  }
}

export async function buyDevices(devices: number): Promise<AddonResult> {
  try {
    const { data } = await apiClient.post<AddonResult>('/billing/add-ons/devices/', { devices });
    return data;
  } catch (error) {
    return unwrapAddonResult(error);
  }
}

// NB: POST /billing/credits/redeem/ exists but is a deliberate 501 stub
// ("store_integration_pending") until the store integration lands. No client
// wrapper here on purpose — it could only ever throw.
