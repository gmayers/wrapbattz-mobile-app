import { apiClient } from '../client';
import type {
  PagedSiteAssignments,
  SiteAssignmentCreate,
  SiteAssignmentRead,
  SiteAssignmentUpdate,
} from '../types';

export interface ListSiteAssignmentsFilter {
  site?: number;
  user?: number;
}

export async function listSiteAssignments(
  filter: ListSiteAssignmentsFilter = {}
): Promise<PagedSiteAssignments> {
  const { data } = await apiClient.get<PagedSiteAssignments>('/site-assignments/', {
    params: filter,
  });
  return data;
}

export async function createSiteAssignment(
  payload: SiteAssignmentCreate
): Promise<SiteAssignmentRead> {
  const { data } = await apiClient.post<SiteAssignmentRead>('/site-assignments/', payload);
  return data;
}

export async function updateSiteAssignment(
  siteAssignmentId: number,
  payload: SiteAssignmentUpdate
): Promise<SiteAssignmentRead> {
  const { data } = await apiClient.patch<SiteAssignmentRead>(
    `/site-assignments/${siteAssignmentId}/`,
    payload
  );
  return data;
}

export async function deleteSiteAssignment(siteAssignmentId: number): Promise<void> {
  await apiClient.delete(`/site-assignments/${siteAssignmentId}/`);
}
