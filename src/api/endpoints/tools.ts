import { apiClient } from '../client';
import type {
  AssignmentRead,
  PagedAssignments,
  PagedTools,
  ToolCategory,
  ToolCreate,
  ToolRead,
  ToolUpdate,
  TransferClaimCreate,
  TransferRead,
} from '../types';

export interface ListToolsParams {
  page?: number;
  page_size?: number;
}

export async function listTools(params: ListToolsParams = {}): Promise<PagedTools> {
  const { data } = await apiClient.get<PagedTools>('/tools/', { params });
  return data;
}

// Every tool in the org. The server clamps page_size to 100, so callers that
// assume full coverage must walk total_pages; maxPages is a runaway guard.
export async function listAllTools(maxPages = 10): Promise<ToolRead[]> {
  const items: ToolRead[] = [];
  let page = 1;
  for (;;) {
    const data = await listTools({ page, page_size: 100 });
    items.push(...(data.items ?? []));
    if (page >= (data.total_pages ?? 1) || page >= maxPages) break;
    page += 1;
  }
  return items;
}

// The org's category catalog, served directly by the backend (replaces the
// old client-side derivation from pages of full tool objects).
export async function listToolCategories(): Promise<ToolCategory[]> {
  const { data } = await apiClient.get<ToolCategory[]>('/tools/categories/');
  return data;
}

export async function createTool(payload: ToolCreate): Promise<ToolRead> {
  const { data } = await apiClient.post<ToolRead>('/tools/', payload);
  return data;
}

export async function getTool(toolId: number): Promise<ToolRead> {
  const { data } = await apiClient.get<ToolRead>(`/tools/${toolId}/`);
  return data;
}

export async function updateTool(toolId: number, payload: ToolUpdate): Promise<ToolRead> {
  const { data } = await apiClient.patch<ToolRead>(`/tools/${toolId}/`, payload);
  return data;
}

export async function deleteTool(toolId: number): Promise<void> {
  await apiClient.delete(`/tools/${toolId}/`);
}

export async function getToolByNfc(tagUid: string): Promise<ToolRead> {
  const { data } = await apiClient.get<ToolRead>(
    `/tools/by-nfc/${encodeURIComponent(tagUid)}/`
  );
  return data;
}

export async function getToolHistory(toolId: number): Promise<PagedAssignments> {
  const { data } = await apiClient.get<PagedAssignments>(`/tools/${toolId}/history/`);
  return data;
}

export async function assignToolToMe(toolId: number): Promise<AssignmentRead> {
  const { data } = await apiClient.post<AssignmentRead>(`/tools/${toolId}/assign-to-me/`);
  return data;
}

export async function assignToolByIdentifier(identifier: string): Promise<AssignmentRead> {
  const { data } = await apiClient.post<AssignmentRead>(
    `/tools/by-identifier/${encodeURIComponent(identifier)}/assign/`
  );
  return data;
}

// Ask the current holder to hand the tool over (a transfer "claim"). Pending
// until the holder (or an owner/admin) accepts — or, when the org has
// transfer confirmation off, accepted immediately.
export async function requestTool(
  toolId: number,
  body: TransferClaimCreate = { message: '' },
): Promise<TransferRead> {
  const { data } = await apiClient.post<TransferRead>(`/tools/${toolId}/request/`, body);
  return data;
}
