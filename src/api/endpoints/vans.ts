import { apiClient } from '../client';
import type { PagedVans, VanCreate, VanRead, VanUpdate } from '../types';

export async function listVans(): Promise<PagedVans> {
  const { data } = await apiClient.get<PagedVans>('/vans/');
  return data;
}

export async function createVan(payload: VanCreate): Promise<VanRead> {
  const { data } = await apiClient.post<VanRead>('/vans/', payload);
  return data;
}

export async function getVan(vanId: number): Promise<VanRead> {
  const { data } = await apiClient.get<VanRead>(`/vans/${vanId}/`);
  return data;
}

export async function updateVan(vanId: number, payload: VanUpdate): Promise<VanRead> {
  const { data } = await apiClient.patch<VanRead>(`/vans/${vanId}/`, payload);
  return data;
}

export async function deleteVan(vanId: number): Promise<void> {
  await apiClient.delete(`/vans/${vanId}/`);
}
