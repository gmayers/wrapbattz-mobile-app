import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DashboardScreen from '../DashboardScreen';

let currentRole: any = 'site_worker';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { role: currentRole } }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: () => {},
}));

jest.mock('../../../hooks/useScanTag', () => ({
  useScanTag: () => ({ scan: jest.fn() }),
}));

jest.mock('../../Transfers/PendingTransfersModal', () => () => null);

let mockUnread = 2;
jest.mock('../../../notifications/queries', () => ({ useUnreadCount: () => ({ count: mockUnread }) }));

describe('DashboardScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUnread = 2;
  });

  it('renders worker QuickAction tiles without the admin-only Notifications tile', () => {
    currentRole = 'site_worker';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Scan')).toBeTruthy();
    expect(screen.getByLabelText('Report Issue')).toBeTruthy();
    expect(screen.getByLabelText('My Tools')).toBeTruthy();
    // Notifications (preferences) is admin/owner-only — it produced an
    // "access denied" popup for site workers, so it must not render here.
    expect(screen.queryByLabelText('Notifications')).toBeNull();
  });

  it('shows the bell for workers and opens the inbox', () => {
    currentRole = 'site_worker';
    render(<DashboardScreen />);
    const bell = screen.getByLabelText('View alerts, unread');
    expect(bell.props.accessibilityRole).toBe('button');
    fireEvent.press(bell);
    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });

  it('labels the worker bell without "unread" when there is nothing unread', () => {
    currentRole = 'site_worker';
    mockUnread = 0;
    render(<DashboardScreen />);
    expect(screen.getByLabelText('View alerts')).toBeTruthy();
    expect(screen.queryByLabelText('View alerts, unread')).toBeNull();
  });

  it('renders Fleet status quick actions for admin role', () => {
    currentRole = 'admin';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Add device')).toBeTruthy();
    expect(screen.getByLabelText('Browse Devices')).toBeTruthy();
    expect(screen.getByLabelText('Log maint.')).toBeTruthy();
    expect(screen.getByLabelText('Export')).toBeTruthy();
  });

  it('renders Control room quick actions for owner role', () => {
    currentRole = 'owner';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Add')).toBeTruthy();
    expect(screen.getByLabelText('Audit')).toBeTruthy();
    expect(screen.getByLabelText('Alerts')).toBeTruthy();
    expect(screen.getByLabelText('Report')).toBeTruthy();
  });
});
