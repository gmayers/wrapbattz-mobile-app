import { apiClient } from '../client';
import type {
  AssignmentCreate,
  AssignmentRead,
  AssignmentReturn,
  AssignmentUpdate,
  PagedAssignments,
  PagedTools,
} from '../types';

export interface ListAssignmentsFilter {
  status?: string;
  tool?: number;
  user?: number;
  site?: number;
}

export async function listAssignments(
  filter: ListAssignmentsFilter = {}
): Promise<PagedAssignments> {
  const { data } = await apiClient.get<PagedAssignments>('/assignments/', { params: filter });
  return data;
}

export async function createAssignment(payload: AssignmentCreate): Promise<AssignmentRead> {
  const { data } = await apiClient.post<AssignmentRead>('/assignments/', payload);
  return data;
}

export async function listMyActiveAssignments(): Promise<AssignmentRead[]> {
  const { data } = await apiClient.get<AssignmentRead[]>('/assignments/mine/active/');
  return data;
}

export async function listMyAssignments(status?: string): Promise<PagedAssignments> {
  const { data } = await apiClient.get<PagedAssignments>('/assignments/mine/', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function listAssignmentsBySite(siteId: number): Promise<PagedAssignments> {
  const { data } = await apiClient.get<PagedAssignments>(`/assignments/site/${siteId}/`);
  return data;
}

export async function listAvailableTools(): Promise<PagedTools> {
  const { data } = await apiClient.get<PagedTools>('/assignments/available-tools/');
  return data;
}

export async function updateAssignment(
  assignmentId: number,
  payload: AssignmentUpdate
): Promise<AssignmentRead> {
  const { data } = await apiClient.patch<AssignmentRead>(
    `/assignments/${assignmentId}/`,
    payload
  );
  return data;
}

export async function returnAssignment(
  assignmentId: number,
  payload: AssignmentReturn = { condition: '', notes: '' }
): Promise<AssignmentRead> {
  const { data } = await apiClient.post<AssignmentRead>(
    `/assignments/${assignmentId}/return/`,
    payload
  );
  return data;
}
