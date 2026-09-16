import { apiClient } from '../client';
import type { MemberRead, MemberUpdate, PagedMembers } from '../types';

export async function listMembers(
  params?: { page?: number; page_size?: number }
): Promise<PagedMembers> {
  const { data } = await apiClient.get<PagedMembers>('/members/', { params });
  return data;
}

export async function getMember(userId: number): Promise<MemberRead> {
  const { data } = await apiClient.get<MemberRead>(`/members/${userId}/`);
  return data;
}

export async function updateMemberRole(userId: number, payload: MemberUpdate): Promise<MemberRead> {
  const { data } = await apiClient.patch<MemberRead>(`/members/${userId}/`, payload);
  return data;
}

export async function removeMember(userId: number): Promise<void> {
  await apiClient.delete(`/members/${userId}/`);
}
