import { apiClient } from '../client';
import type {
  MarkAllReadResult,
  NotificationRead,
  OrgPolicy,
  OrgPolicyUpdate,
  PagedNotifications,
  UnreadCount,
  UserPreferences,
} from '../types';

export interface ListNotificationsParams {
  status?: 'all' | 'unread';
  cursor?: string | null;
  limit?: number;
}

export async function listNotifications(
  params: ListNotificationsParams
): Promise<PagedNotifications> {
  const query: Record<string, string | number> = {};
  if (params.status) query.status = params.status;
  if (params.cursor) query.cursor = params.cursor;
  if (params.limit) query.limit = params.limit;
  const { data } = await apiClient.get<PagedNotifications>('/account/notifications/', {
    params: query,
  });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<UnreadCount>('/account/notifications/unread-count/');
  return data.count;
}

export async function markNotificationRead(id: number, read = true): Promise<NotificationRead> {
  const { data } = await apiClient.patch<NotificationRead>(`/account/notifications/${id}/`, {
    read,
  });
  return data;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await apiClient.post<MarkAllReadResult>(
    '/account/notifications/mark-all-read/'
  );
  return data.updated;
}

export async function getNotificationPreferences(): Promise<UserPreferences> {
  const { data } = await apiClient.get<UserPreferences>('/account/notification-preferences/');
  return data;
}

export async function updateNotificationPreferences(
  payload: UserPreferences
): Promise<UserPreferences> {
  const { data } = await apiClient.put<UserPreferences>(
    '/account/notification-preferences/',
    payload
  );
  return data;
}

export async function getNotificationPolicy(): Promise<OrgPolicy> {
  const { data } = await apiClient.get<OrgPolicy>('/organizations/me/notification-policy/');
  return data;
}

export async function updateNotificationPolicy(payload: OrgPolicyUpdate): Promise<OrgPolicy> {
  const { data } = await apiClient.put<OrgPolicy>(
    '/organizations/me/notification-policy/',
    payload
  );
  return data;
}
