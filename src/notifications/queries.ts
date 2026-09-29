import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as api from '../api/endpoints/notifications';
import type { OrgPolicyUpdate, PagedNotifications, UserPreferences } from '../api/types';

type Status = 'all' | 'unread';
const PAGE_SIZE = 25;

export const notificationKeys = {
  all: ['notifications'] as const,
  feed: (status: Status) => ['notifications', 'feed', status] as const,
  unread: ['notifications', 'unread-count'] as const,
  prefs: ['notifications', 'preferences'] as const,
  policy: ['notifications', 'policy'] as const,
};

export function useNotificationsFeed(status: Status) {
  return useInfiniteQuery({
    queryKey: notificationKeys.feed(status),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.listNotifications({ status, cursor: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (last: PagedNotifications) => last.next_cursor ?? undefined,
  });
}

export function useUnreadCount() {
  const q = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: api.getUnreadCount,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });
  return { count: q.data ?? 0, isLoading: q.isLoading };
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      qc.setQueriesData<InfiniteData<PagedNotifications>>(
        { queryKey: ['notifications', 'feed'] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              items: p.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
            })),
          }
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useNotificationPreferences() {
  return useQuery({ queryKey: notificationKeys.prefs, queryFn: api.getNotificationPreferences });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserPreferences) => api.updateNotificationPreferences(payload),
    onSuccess: (data) => {
      qc.setQueryData(notificationKeys.prefs, data);
      // Preference changes can affect what shows up in the feed/unread count
      // (e.g. muting a type), so refresh everything notification-related.
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useNotificationPolicy(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.policy,
    queryFn: api.getNotificationPolicy,
    enabled,
  });
}

export function useUpdateNotificationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrgPolicyUpdate) => api.updateNotificationPolicy(payload),
    onSuccess: (data) => {
      qc.setQueryData(notificationKeys.policy, data);
      // Policy changes alter what the user's own preferences screen shows (and
      // potentially the feed/unread count), so refresh everything
      // notification-related. notificationKeys.all (['notifications']) is a
      // prefix of notificationKeys.prefs, so this also covers the preferences
      // query without a separate invalidateQueries call.
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
