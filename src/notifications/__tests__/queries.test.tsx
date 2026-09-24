import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as api from '../../api/endpoints/notifications';
import { useMarkAllRead, useMarkRead, useNotificationsFeed, useUnreadCount } from '../queries';

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

  it('mark read updates the cached feed optimistically', async () => {
    // onSettled invalidates and refetches the feed; without this the mocked
    // refetch would resolve with the still-unread item and race the optimistic
    // update, per the brief's documented adjustment.
    (api.listNotifications as jest.Mock)
      .mockResolvedValueOnce({ items: [item(1)], next_cursor: null, prev_cursor: null })
      .mockResolvedValue({ items: [item(1, true)], next_cursor: null, prev_cursor: null });
    (api.markNotificationRead as jest.Mock).mockResolvedValue(item(1, true));
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () => ({ feed: useNotificationsFeed('all'), mark: useMarkRead() }),
      { wrapper: Wrapper }
    );
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true));
    expect(result.current.feed.data?.pages[0].items[0].is_read).toBe(false);
    await act(() => result.current.mark.mutateAsync(1));
    // As above: the observer notifies via a real setTimeout(0), so
    // mutateAsync's own promise can resolve slightly before the optimistic
    // update is visible on result.current; wait for it instead of asserting
    // synchronously.
    await waitFor(() =>
      expect(result.current.feed.data?.pages[0].items[0].is_read).toBe(true)
    );
  });

  it('mark all read invalidates notification queries', async () => {
    (api.markAllNotificationsRead as jest.Mock).mockResolvedValue(3);
    const { client, Wrapper } = wrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useMarkAllRead(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync());
    expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });
});
