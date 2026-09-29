import React from 'react';
import { Alert, RefreshControl } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NotificationsScreen from '../NotificationsScreen';
import * as q from '../../../notifications/queries';

jest.mock('../../../notifications/queries');
jest.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ isAdminOrOwner: false }) }));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: { background: '#fff', card: '#fff', textPrimary: '#000', textSecondary: '#666', primary: '#FFC72C', border: '#eee' } }),
}));
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
  // NotificationsScreen pulls in linkRouting -> navigationRef, which calls this
  // at module scope; without a stub here the whole-module mock above leaves it
  // undefined and the import chain throws before any test runs.
  createNavigationContainerRef: () => ({}),
}));

const item = (id: number, extra: any = {}) => ({
  id, notification_type: 'transfer_requested', title: `Title ${id}`, message: 'Body',
  is_read: false, read_at: null, created_at: '2026-09-24T10:00:00Z', link: null, ...extra,
});

const markRead = jest.fn();
const markAll = jest.fn();

function feed(items: any[], extra: any = {}) {
  (q.useNotificationsFeed as jest.Mock).mockReturnValue({
    data: { pages: [{ items, next_cursor: null }] },
    isLoading: false, isError: false, isRefetching: false,
    hasNextPage: false, fetchNextPage: jest.fn(), refetch: jest.fn(), ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (q.useMarkRead as jest.Mock).mockReturnValue({ mutate: markRead });
  (q.useMarkAllRead as jest.Mock).mockReturnValue({ mutate: markAll, isPending: false });
});

it('renders rows and switches to the Unread tab', () => {
  feed([item(1)]);
  render(<NotificationsScreen />);
  expect(screen.getByText('Title 1')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Show unread'));
  expect(q.useNotificationsFeed).toHaveBeenLastCalledWith('unread');
});

it('tapping a row marks it read and follows its link', () => {
  feed([item(1, { link: { kind: 'tool', id: 7 } })]);
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByText('Title 1'));
  expect(markRead).toHaveBeenCalledWith(1);
  expect(mockNavigate).toHaveBeenCalledWith('DeviceDetails', { deviceId: 7 });
});

it('a row with no link only marks read', () => {
  feed([item(1)]);
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByText('Title 1'));
  expect(markRead).toHaveBeenCalledWith(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('mark all read', () => {
  feed([item(1)]);
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByLabelText('Mark all read'));
  expect(markAll).toHaveBeenCalled();
});

it('shows an alert when mark all read fails', () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  feed([item(1)]);
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByLabelText('Mark all read'));
  markAll.mock.calls[0][1].onError(new Error('offline'));
  expect(Alert.alert).toHaveBeenCalledWith("Couldn't mark all read", expect.any(String));
});

it('hides mark all read when the list is empty', () => {
  feed([]);
  render(<NotificationsScreen />);
  expect(screen.queryByLabelText('Mark all read')).toBeNull();
});

it('pull-to-refresh spinner follows the pull, not background refetches', async () => {
  let resolve!: () => void;
  const refetch = jest.fn(() => new Promise<void>((r) => (resolve = r)));
  feed([item(1)], { isRefetching: true, refetch });
  render(<NotificationsScreen />);
  const rc = () => screen.UNSAFE_getByType(RefreshControl);
  expect(rc().props.refreshing).toBe(false);
  expect(rc().props.tintColor).toBe('#FFC72C');
  expect(rc().props.colors).toEqual(['#FFC72C']);
  act(() => rc().props.onRefresh());
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(rc().props.refreshing).toBe(true);
  await act(async () => resolve());
  expect(rc().props.refreshing).toBe(false);
});

it('does not fetch another page while one is in flight, and shows a footer spinner', () => {
  const fetchNextPage = jest.fn();
  feed([item(1)], { hasNextPage: true, isFetchingNextPage: true, fetchNextPage });
  render(<NotificationsScreen />);
  const list = screen.UNSAFE_getByProps({ onEndReachedThreshold: 0.5 });
  list.props.onEndReached();
  expect(fetchNextPage).not.toHaveBeenCalled();
  expect(screen.getByTestId('notifications-next-page')).toBeTruthy();
});

it('fetches the next page at the end of the list when idle', () => {
  const fetchNextPage = jest.fn();
  feed([item(1)], { hasNextPage: true, isFetchingNextPage: false, fetchNextPage });
  render(<NotificationsScreen />);
  screen.UNSAFE_getByProps({ onEndReachedThreshold: 0.5 }).props.onEndReached();
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('notifications-next-page')).toBeNull();
});

it('exposes tab selection and unread state to screen readers', () => {
  feed([item(1), item(2, { is_read: true })]);
  render(<NotificationsScreen />);
  expect(screen.getByLabelText('Show all').props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByLabelText('Show unread').props.accessibilityState).toEqual({ selected: false });
  expect(screen.getByLabelText('Unread, Title 1, Body')).toBeTruthy();
  expect(screen.getByLabelText('Title 2, Body')).toBeTruthy();
});

it('empty and error states', () => {
  feed([]);
  const { rerender } = render(<NotificationsScreen />);
  expect(screen.getByText("You're all caught up")).toBeTruthy();
  feed([], { isError: true });
  rerender(<NotificationsScreen />);
  expect(screen.getByText("Couldn't load notifications")).toBeTruthy();
});
