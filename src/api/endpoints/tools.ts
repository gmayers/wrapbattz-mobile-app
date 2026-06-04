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

// Categories (the make/model/type values extracted into their own table) have
// no dedicated lookup route on the API — they're only surfaced via the
// category_id/category_name fields on tools. Until the backend exposes a
// categories endpoint, derive the selectable options from the distinct
// categories present on existing tools.
export async function listToolCategories(): Promise<ToolCategory[]> {
  const { data } = await apiClient.get<PagedTools>('/tools/', { params: { page_size: 200 } });
  const items: any[] = data?.items ?? [];
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
