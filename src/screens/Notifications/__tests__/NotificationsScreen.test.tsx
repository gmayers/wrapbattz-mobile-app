import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
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

it('empty and error states', () => {
  feed([]);
  const { rerender } = render(<NotificationsScreen />);
  expect(screen.getByText("You're all caught up")).toBeTruthy();
  feed([], { isError: true });
  rerender(<NotificationsScreen />);
  expect(screen.getByText("Couldn't load notifications")).toBeTruthy();
});
