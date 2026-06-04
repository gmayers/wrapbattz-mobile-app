import React from 'react';
import { render, screen } from '@testing-library/react-native';
import DashboardScreen from '../DashboardScreen';

let currentRole: any = 'site_worker';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { role: currentRole } }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../../hooks/useScanTag', () => ({
  useScanTag: () => ({ scan: jest.fn() }),
}));

describe('DashboardScreen', () => {
  beforeEach(() => { mockNavigate.mockClear(); });

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

  it('renders Fleet status quick actions for admin role', () => {
    currentRole = 'admin';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Add device')).toBeTruthy();
    expect(screen.getByLabelText('Print tags')).toBeTruthy();
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
