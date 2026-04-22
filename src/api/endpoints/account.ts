import { apiClient } from '../client';
import type {
  NotificationMarkReadRequest,
  NotificationRead,
  OnboardingUpdate,
  PushTokenDelete,
  PushTokenRead,
  PushTokenRequest,
  UserMe,
  UserUpdate,
} from '../types';

export async function getMe(): Promise<UserMe> {
  const { data } = await apiClient.get<UserMe>('/account/');
  return data;
}

export async function updateMe(payload: UserUpdate): Promise<UserMe> {
  const { data } = await apiClient.patch<UserMe>('/account/', payload);
  return data;
}

export async function updateOnboarding(payload: OnboardingUpdate): Promise<UserMe> {
  const { data } = await apiClient.patch<UserMe>('/account/onboarding/', payload);
  return data;
}

export async function registerPushToken(payload: PushTokenRequest): Promise<PushTokenRead> {
  const { data } = await apiClient.post<PushTokenRead>('/account/push-tokens/', payload);
  return data;
}

export async function unregisterPushToken(payload: PushTokenDelete): Promise<void> {
  await apiClient.delete('/account/push-tokens/', { data: payload });
}

export async function listNotifications(): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get<Record<string, unknown>>('/account/notifications/');
  return data;
}

export async function markNotification(
  notificationId: number,
  payload: NotificationMarkReadRequest = { read: true }
): Promise<NotificationRead> {
  const { data } = await apiClient.patch<NotificationRead>(
    `/account/notifications/${notificationId}/`,
    payload
  );
  return data;
}
