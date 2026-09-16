import { apiClient } from '../client';
import type { PagedSites, SiteCreate, SiteRead, SiteUpdate } from '../types';

export interface ListSitesFilter {
  site_type?: string;
  status?: string;
  page?: number;
  page_size?: number; // server clamps to 100
}

export async function listSites(filter: ListSitesFilter = {}): Promise<PagedSites> {
  const { data } = await apiClient.get<PagedSites>('/sites/', { params: filter });
  return data;
}

// Every site in the org. The server clamps page_size to 100, so callers that
// assume full coverage (location selectors) must walk total_pages; maxPages is
// a runaway guard.
export async function listAllSites(maxPages = 10): Promise<SiteRead[]> {
  const items: SiteRead[] = [];
  let page = 1;
  for (;;) {
    const data = await listSites({ page, page_size: 100 });
    items.push(...(data.items ?? []));
    if (page >= (data.total_pages ?? 1) || page >= maxPages) break;
    page += 1;
  }
  return items;
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
