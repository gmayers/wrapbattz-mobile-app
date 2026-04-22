import { apiClient } from '../client';
import type {
  AssignmentRead,
  PagedAssignments,
  PagedTools,
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
