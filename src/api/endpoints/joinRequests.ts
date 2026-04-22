import { apiClient } from '../client';
import type {
  JoinRequestApprove,
  JoinRequestCreate,
  JoinRequestDeny,
  JoinRequestRead,
  PagedJoinRequests,
} from '../types';

export async function createJoinRequest(payload: JoinRequestCreate): Promise<JoinRequestRead> {
  const { data } = await apiClient.post<JoinRequestRead>('/join-requests/', payload);
  return data;
}

export async function listJoinRequests(): Promise<PagedJoinRequests> {
  const { data } = await apiClient.get<PagedJoinRequests>('/join-requests/');
  return data;
}

export async function getMyJoinRequest(): Promise<JoinRequestRead | null> {
  const { data } = await apiClient.get<JoinRequestRead | null>('/join-requests/mine/');
  return data;
}

export async function cancelMyJoinRequest(): Promise<void> {
  await apiClient.delete('/join-requests/mine/');
}

export async function approveJoinRequest(
  joinRequestId: number,
  payload: JoinRequestApprove
): Promise<JoinRequestRead> {
  const { data } = await apiClient.post<JoinRequestRead>(
    `/join-requests/${joinRequestId}/approve/`,
    payload
  );
  return data;
}

export async function denyJoinRequest(
  joinRequestId: number,
  payload: JoinRequestDeny = { reason: '' }
): Promise<JoinRequestRead> {
  const { data } = await apiClient.post<JoinRequestRead>(
    `/join-requests/${joinRequestId}/deny/`,
    payload
  );
  return data;
}
