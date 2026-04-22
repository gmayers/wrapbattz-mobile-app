import { apiClient } from '../client';
import type { ToolPhotoRead } from '../types';

export async function listToolPhotos(toolId: number): Promise<ToolPhotoRead[]> {
  const { data } = await apiClient.get<ToolPhotoRead[]>(`/tools/${toolId}/photos/`);
  return data;
}

export interface UploadToolPhotoInput {
  uri: string;
  name: string;
  type: string;
  isSignature?: boolean;
  description?: string;
}

export async function uploadToolPhoto(
  toolId: number,
  input: UploadToolPhotoInput
): Promise<ToolPhotoRead> {
  const form = new FormData();
  // React Native FormData accepts this shape for file uploads.
  form.append('file', {
    uri: input.uri,
    name: input.name,
    type: input.type,
  } as unknown as Blob);
  if (input.isSignature !== undefined) {
    form.append('is_signature', String(input.isSignature));
  }
  if (input.description !== undefined) {
    form.append('description', input.description);
  }

  const { data } = await apiClient.post<ToolPhotoRead>(
    `/tools/${toolId}/photos/`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data;
}

export async function deleteToolPhoto(photoId: number): Promise<void> {
  await apiClient.delete(`/tools/photos/${photoId}/`);
}
