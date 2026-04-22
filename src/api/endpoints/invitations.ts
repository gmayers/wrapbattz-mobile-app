import { apiClient } from '../client';
import type {
  InvitationAccept,
  InvitationByTokenRead,
  InvitationCreate,
  InvitationRead,
  PagedInvitations,
  TokenResponse,
} from '../types';

export async function acceptInvitation(payload: InvitationAccept): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/invitations/accept/', payload);
  return data;
}

export async function getInvitationByToken(token: string): Promise<InvitationByTokenRead> {
  const { data } = await apiClient.get<InvitationByTokenRead>(
    `/invitations/by-token/${encodeURIComponent(token)}/`
  );
  return data;
}

export async function listInvitations(): Promise<PagedInvitations> {
  const { data } = await apiClient.get<PagedInvitations>('/invitations/');
  return data;
}

export async function createInvitation(payload: InvitationCreate): Promise<InvitationRead> {
  const { data } = await apiClient.post<InvitationRead>('/invitations/', payload);
  return data;
}

export async function revokeInvitation(invitationId: number): Promise<void> {
  await apiClient.delete(`/invitations/${invitationId}/`);
}

export async function resendInvitation(invitationId: number): Promise<InvitationRead> {
  const { data } = await apiClient.post<InvitationRead>(`/invitations/${invitationId}/resend/`);
  return data;
}
