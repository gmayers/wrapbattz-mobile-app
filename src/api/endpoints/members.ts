import { apiClient } from '../client';
import type { MemberRead, MemberUpdate, PagedMembers } from '../types';

export async function listMembers(): Promise<PagedMembers> {
  const { data } = await apiClient.get<PagedMembers>('/members/');
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
