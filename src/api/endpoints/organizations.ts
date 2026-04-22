import { apiClient } from '../client';
import type {
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
