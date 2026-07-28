import { apiClient } from '../client';
import type {
  IncidentCreate,
  IncidentRead,
  IncidentUpdate,
  PagedIncidents,
} from '../types';

// Server-side filters (also on /mine/). page_size is clamped to 100 by the
// backend; walk total_pages when full coverage matters.
export interface IncidentListFilter {
  status?: string;
  severity?: string;
  tool?: number;
  site?: number;
  page?: number;
  page_size?: number;
}

export async function listIncidents(params?: IncidentListFilter): Promise<PagedIncidents> {
  const { data } = await apiClient.get<PagedIncidents>('/incidents/', { params });
  return data;
}

export async function createIncident(payload: IncidentCreate): Promise<IncidentRead> {
  const { data } = await apiClient.post<IncidentRead>('/incidents/', payload);
  return data;
}

export async function listMyIncidents(params?: IncidentListFilter): Promise<PagedIncidents> {
  const { data } = await apiClient.get<PagedIncidents>('/incidents/mine/', { params });
  return data;
}

export async function getIncident(incidentId: number): Promise<IncidentRead> {
  const { data } = await apiClient.get<IncidentRead>(`/incidents/${incidentId}/`);
  return data;
}

export async function updateIncident(
  incidentId: number,
  payload: IncidentUpdate
): Promise<IncidentRead> {
  const { data } = await apiClient.patch<IncidentRead>(`/incidents/${incidentId}/`, payload);
  return data;
}

export async function deleteIncident(incidentId: number): Promise<void> {
  await apiClient.delete(`/incidents/${incidentId}/`);
}
