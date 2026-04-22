import { apiClient } from '../client';
import type { PagedSites, SiteCreate, SiteRead, SiteUpdate } from '../types';

export interface ListSitesFilter {
  site_type?: string;
  status?: string;
}

export async function listSites(filter: ListSitesFilter = {}): Promise<PagedSites> {
  const { data } = await apiClient.get<PagedSites>('/sites/', { params: filter });
  return data;
}

export async function createSite(payload: SiteCreate): Promise<SiteRead> {
  const { data } = await apiClient.post<SiteRead>('/sites/', payload);
  return data;
}

export async function getSite(siteId: number): Promise<SiteRead> {
  const { data } = await apiClient.get<SiteRead>(`/sites/${siteId}/`);
  return data;
}

export async function updateSite(siteId: number, payload: SiteUpdate): Promise<SiteRead> {
  const { data } = await apiClient.patch<SiteRead>(`/sites/${siteId}/`, payload);
  return data;
}

export async function deleteSite(siteId: number): Promise<void> {
  await apiClient.delete(`/sites/${siteId}/`);
}

export async function listSitesForTool(toolId: number): Promise<PagedSites> {
  const { data } = await apiClient.get<PagedSites>(`/sites/for-tool/${toolId}/`);
  return data;
}
