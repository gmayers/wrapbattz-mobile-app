import { apiClient } from '../client';
import type { PagedTransfers, TransferCreate, TransferRead } from '../types';

// Creates a pending transfer, or — when the organisation has confirmation
// switched off — performs the handover straight away (status "accepted").
export async function createTransfer(payload: TransferCreate): Promise<TransferRead> {
  const { data } = await apiClient.post<TransferRead>('/assignments/transfers/', payload);
  return data;
}

// Owner/admin: organisation-wide transfer log.
export async function listTransfers(status?: string): Promise<PagedTransfers> {
  const { data } = await apiClient.get<PagedTransfers>('/assignments/transfers/', {
    params: status ? { status } : undefined,
  });
  return data;
}

// Unexpired pending transfers addressed to the caller.
export async function listPendingForMe(): Promise<TransferRead[]> {
  const { data } = await apiClient.get<TransferRead[]>('/assignments/transfers/pending/');
  return data;
}

export async function acceptTransfer(transferId: number): Promise<TransferRead> {
  const { data } = await apiClient.post<TransferRead>(`/assignments/transfers/${transferId}/accept/`);
  return data;
}

export async function declineTransfer(transferId: number): Promise<TransferRead> {
  const { data } = await apiClient.post<TransferRead>(`/assignments/transfers/${transferId}/decline/`);
  return data;
}

export async function cancelTransfer(transferId: number): Promise<TransferRead> {
  const { data } = await apiClient.post<TransferRead>(`/assignments/transfers/${transferId}/cancel/`);
  return data;
}
