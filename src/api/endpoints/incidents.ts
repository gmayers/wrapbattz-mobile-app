import { apiClient } from '../client';
import type {
  IncidentCreate,
  IncidentRead,
  IncidentUpdate,
  PagedIncidents,
} from '../types';

export async function listIncidents(): Promise<PagedIncidents> {
  const { data } = await apiClient.get<PagedIncidents>('/incidents/');
  return data;
}

export async function createIncident(payload: IncidentCreate): Promise<IncidentRead> {
  const { data } = await apiClient.post<IncidentRead>('/incidents/', payload);
  return data;
}

export async function listMyIncidents(): Promise<PagedIncidents> {
  const { data } = await apiClient.get<PagedIncidents>('/incidents/mine/');
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
