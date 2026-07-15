import { apiClient } from '../client';
import type {
  DemoDataStatus,
  OrganizationCreate,
  OrganizationRead,
  OrganizationUpdate,
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
