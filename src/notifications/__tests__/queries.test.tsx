import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as api from '../../api/endpoints/notifications';
import {
  useMarkAllRead,
  useMarkRead,
  useNotificationsFeed,
  useUnreadCount,
  useUpdateNotificationPolicy,
  useUpdateNotificationPreferences,
} from '../queries';

jest.mock('../../api/endpoints/notifications');

function wrapper() {
  // staleTime: 0 + gcTime: Infinity matches the pattern already used in
  // LocationsScreen.test.js / ReportsScreen.test.js: the react-native jest
  // preset polyfills `global.window = global`, so @tanstack/react-query's
  // isServer() check is false and it schedules real gc/refetch timers. A
  // finite gcTime leaves a real 5-minute setTimeout on the query the instant
  // the last observer unsubscribes, which keeps the Jest process alive
  // ("Jest did not exit one second after the test run has completed").
  // gcTime: Infinity makes that scheduling a no-op (isValidTimeout rejects
  // Infinity); RTL's automatic unmount-on-afterEach clears the observer-level
  // stale/refetch-interval timers via QueryObserver#destroy. Mutations are
  // Removable too (mutation.js calls scheduleGc using defaultOptions.mutations,
  // not defaultOptions.queries), so useMarkRead/useMarkAllRead need the same
  // gcTime override or their mutation cache entries leave the same handle.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}

const item = (id: number, is_read = false) => ({
  id, notification_type: 'system', title: `t${id}`, message: 'm', is_read,
  read_at: null, created_at: '2026-09-24T10:00:00Z', link: null,
});

describe('notification queries', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pages the feed with next_cursor', async () => {
    (api.listNotifications as jest.Mock)
      .mockResolvedValueOnce({ items: [item(1)], next_cursor: 'c2', prev_cursor: null })
      .mockResolvedValueOnce({ items: [item(2)], next_cursor: null, prev_cursor: 'c2' });
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useNotificationsFeed('unread'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.listNotifications).toHaveBeenCalledWith({ status: 'unread', cursor: null, limit: 25 });
    // TanStack Query v5 result objects are tracked-property proxies: a field
    // only triggers a re-render on change once something has read it. Reading
    // hasNextPage here (true, since page 1 has a next_cursor) both asserts
    // real behaviour and registers it so the post-fetchNextPage flip to
    // false below is actually observed by this renderHook's result ref.
    expect(result.current.hasNextPage).toBe(true);
    await act(() => result.current.fetchNextPage());
    expect(api.listNotifications).toHaveBeenLastCalledWith({ status: 'unread', cursor: 'c2', limit: 25 });
    // notifyManager batches the observer's update via a real setTimeout, so
    // fetchNextPage()'s own promise can resolve before the component
    // re-renders with page 2; wait for it rather than asserting synchronously.
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('exposes the unread count', async () => {
    (api.getUnreadCount as jest.Mock).mockResolvedValue(5);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useUnreadCount(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.count).toBe(5));
  });

  it('mark read updates the cached feed optimistically before the mutation resolves', async () => {
    // onSettled invalidates and refetches the feed; without this the mocked
    // refetch would resolve with the still-unread item and race the optimistic
    // update, per the brief's documented adjustment.
    (api.listNotifications as jest.Mock)
      .mockResolvedValueOnce({ items: [item(1)], next_cursor: null, prev_cursor: null })
      .mockResolvedValue({ items: [item(1, true)], next_cursor: null, prev_cursor: null });
    // markNotificationRead is held pending (never resolved until we say so),
    // so that flipping is_read to true while the mutation is still in flight
    // can only be the onMutate optimistic update, not a post-success refetch.
    let resolveMark!: (value: unknown) => void;
    (api.markNotificationRead as jest.Mock).mockImplementation(
      () => new Promise((resolve) => { resolveMark = resolve; })
    );
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () => ({ feed: useNotificationsFeed('all'), mark: useMarkRead() }),
      { wrapper: Wrapper }
    );
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true));
    expect(result.current.feed.data?.pages[0].items[0].is_read).toBe(false);

    act(() => {
      result.current.mark.mutate(1);
    });

    // notifyManager batches observer updates via a real setTimeout(0), so
    // wait for it rather than asserting synchronously.
    await waitFor(() =>
      expect(result.current.feed.data?.pages[0].items[0].is_read).toBe(true)
    );
    // The mutation must still be pending here — markNotificationRead's promise
    // has not been resolved yet — proving the flip above came from onMutate.
    expect(result.current.mark.isPending).toBe(true);
    expect(api.markNotificationRead).toHaveBeenCalledWith(1);

    // Let the mutation settle so it doesn't leak a pending promise past this test.
    resolveMark(item(1, true));
    await waitFor(() => expect(result.current.mark.isPending).toBe(false));
  });

  it('mark all read invalidates notification queries', async () => {
    (api.markAllNotificationsRead as jest.Mock).mockResolvedValue(3);
    const { client, Wrapper } = wrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useMarkAllRead(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync());
    expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('updating notification preferences invalidates all notification queries', async () => {
    const prefs = {
      master: { push: true, email: false },
      types: [],
    };
    (api.updateNotificationPreferences as jest.Mock).mockResolvedValue(prefs);
    const { client, Wrapper } = wrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateNotificationPreferences(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync(prefs));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('updating notification policy invalidates all notification queries', async () => {
    const policyUpdate = {
      digest_minutes: 60,
      members_can_disable_push: true,
      members_can_disable_email: true,
      types: [],
    };
    const policy = { ...policyUpdate, digest_minutes: 60 };
    (api.updateNotificationPolicy as jest.Mock).mockResolvedValue(policy);
    const { client, Wrapper } = wrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateNotificationPolicy(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync(policyUpdate));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });
});
