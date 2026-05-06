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

jest.mock('../OfficeWorker/hooks/useOfficeWorkerWhereData', () => ({
  useOfficeWorkerWhereData: () => ({
    isLoading: false,
    refresh: jest.fn(),
    organizationName: 'TESTORG',
    userInitials: 'XY',
    hasUnreadAlerts: null,
    counts: { sites: 0, vehicles: 0, toolboxes: 0, total: 0 },
    totalToolsPlaced: 0,
    locations: [],
    pendingApprovals: null,
    returnsDue: null,
  }),
}));
jest.mock('../OfficeWorker/hooks/useOfficeWorkerTeamData', () => ({
  useOfficeWorkerTeamData: () => ({
    isLoading: false,
    refresh: jest.fn(),
    organizationName: 'TESTORG',
    userInitials: 'XY',
    hasUnreadAlerts: null,
    totalMembers: 0,
    totalToolsOut: 0,
    onSite: null,
    hq: null,
    members: [],
  }),
}));

describe('DashboardScreen', () => {
  beforeEach(() => { mockNavigate.mockClear(); });

  it('renders 4 QuickAction tiles for worker role', () => {
    currentRole = 'site_worker';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Scan')).toBeTruthy();
    expect(screen.getByLabelText('Report Issue')).toBeTruthy();
    expect(screen.getByLabelText('My Tools')).toBeTruthy();
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
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

  it('renders office-worker dashboard for office_worker role', () => {
    currentRole = 'office_worker';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Where tab')).toBeTruthy();
    expect(screen.getByLabelText('Team tab')).toBeTruthy();
  });
});
