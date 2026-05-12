import { apiClient } from '../client';
import type {
  CatalogResponse,
  IapRestoreRequest,
  IapVerifyRequest,
  SubscriptionState,
} from '../types-billing';

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
