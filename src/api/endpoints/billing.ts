import { apiClient } from '../client';
import type { BillingState, CustomerSheetSession, Invoice, StoreCredit, StoreLink } from '../types-billing';

export async function getBillingState(): Promise<BillingState> {
  const { data } = await apiClient.get<BillingState>('/billing/');
  return data;
}

export async function listInvoices(): Promise<Invoice[]> {
  const { data } = await apiClient.get<Invoice[]>('/billing/invoices/');
  return data;
}

export async function createCustomerSheetSession(): Promise<CustomerSheetSession> {
  const { data } = await apiClient.post<CustomerSheetSession>('/billing/customer-sheet/');
  return data;
}

export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
  await apiClient.post('/billing/payment-method/default/', { payment_method_id: paymentMethodId });
}

export async function cancelSubscription(): Promise<BillingState> {
  const { data } = await apiClient.post<BillingState>('/billing/subscription/cancel/');
  return data;
}

export async function resumeSubscription(): Promise<BillingState> {
  const { data } = await apiClient.post<BillingState>('/billing/subscription/resume/');
  return data;
}

export async function getStoreCredit(): Promise<StoreCredit> {
  const { data } = await apiClient.get<StoreCredit>('/billing/credits/');
  return data;
}

/** Fetch when the user taps "Spend in store": the link is single-use. */
export async function createStoreLink(): Promise<StoreLink> {
  const { data } = await apiClient.post<StoreLink>('/billing/credits/store-link/');
  return data;
}
