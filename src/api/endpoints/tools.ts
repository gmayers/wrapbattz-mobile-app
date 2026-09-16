import { apiClient } from '../client';
import type {
  AssignmentRead,
  PagedAssignments,
  PagedTools,
  ToolCategory,
  ToolCreate,
  ToolRead,
  ToolUpdate,
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

// Categories (the make/model/type values extracted into their own table) have
// no dedicated lookup route on the API — they're only surfaced via the
// category_id/category_name fields on tools. Until the backend exposes a
// categories endpoint, derive the selectable options from the distinct
// categories present on existing tools.
export async function listToolCategories(): Promise<ToolCategory[]> {
  const items: any[] = await listAllTools();
  const seen = new Map<number, string>();
  for (const tool of items) {
    const id = tool?.category_id;
    if (id === undefined || id === null) continue;
    if (!seen.has(Number(id))) {
      seen.set(Number(id), String(tool?.category_name || id));
    }
  }
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

export async function requestTool(
  toolId: number,
  body: { message?: string } = {},
): Promise<{ id: number; status: string }> {
  const { data } = await apiClient.post(`/tools/${toolId}/request/`, body);
  return data as { id: number; status: string };
}
