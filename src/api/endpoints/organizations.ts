import { apiClient } from '../client';
import type {
  DemoDataStatus,
  NfcLockConfig,
  NfcLockUpdate,
  OrganizationCreate,
  OrganizationRead,
  OrganizationUpdate,
  OrgStats,
} from '../types';

export async function createOrganization(payload: OrganizationCreate): Promise<OrganizationRead> {
  const { data } = await apiClient.post<OrganizationRead>('/organizations/', payload);
  return data;
}

export async function getMyOrganization(): Promise<OrganizationRead> {
  const { data } = await apiClient.get<OrganizationRead>('/organizations/me/');
  return data;
}

export async function updateMyOrganization(payload: OrganizationUpdate): Promise<OrganizationRead> {
  const { data } = await apiClient.patch<OrganizationRead>('/organizations/me/', payload);
  return data;
}

// Demo data — same sample site + tools as the web dashboard's
// "try with demo data" button. Owner/admin only for create/delete.
// Dashboard counts in one call — replaces downloading full tool/incident/
// member lists just to compute scalars client-side.
export async function getOrgStats(): Promise<OrgStats> {
  const { data } = await apiClient.get<OrgStats>('/organizations/me/stats/');
  return data;
}

export async function getDemoDataStatus(): Promise<DemoDataStatus> {
  const { data } = await apiClient.get<DemoDataStatus>('/organizations/demo-data/');
  return data;
}

export async function createDemoData(): Promise<DemoDataStatus> {
  const { data } = await apiClient.post<DemoDataStatus>('/organizations/demo-data/');
  return data;
}

export async function deleteDemoData(): Promise<DemoDataStatus> {
  const { data } = await apiClient.delete<DemoDataStatus>('/organizations/demo-data/');
  return data;
}

// NFC tag lock — owner/admin only (403 for other roles). The response holds
// the lock code: keep it in memory only (see services/nfcLockStore) and never
// log it.
export async function getNfcLock(): Promise<NfcLockConfig> {
  const { data } = await apiClient.get<NfcLockConfig>('/organizations/me/nfc-lock/');
  return data;
}

/** Set a PIN / hex code, or `{ generate: true }`. The old code becomes "previous". */
export async function setNfcLock(payload: NfcLockUpdate): Promise<NfcLockConfig> {
  const { data } = await apiClient.put<NfcLockConfig>('/organizations/me/nfc-lock/', payload);
  return data;
}

/** Turn the lock off. The current code moves to "previous" so tags can still be unlocked. */
export async function disableNfcLock(): Promise<NfcLockConfig> {
  const { data } = await apiClient.delete<NfcLockConfig>('/organizations/me/nfc-lock/');
  return data;
}
