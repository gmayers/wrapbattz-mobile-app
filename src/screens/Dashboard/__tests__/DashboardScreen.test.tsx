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

  it('renders 4 QuickAction tiles for worker role', () => {
    currentRole = 'site_worker';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Scan')).toBeTruthy();
    expect(screen.getByLabelText('Report Issue')).toBeTruthy();
    expect(screen.getByLabelText('My Tools')).toBeTruthy();
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
  });

  it('renders 8 QuickAction tiles for admin role', () => {
    currentRole = 'admin';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Add Tool')).toBeTruthy();
    expect(screen.getByLabelText('Sites')).toBeTruthy();
    expect(screen.getByLabelText('Invite User')).toBeTruthy();
    expect(screen.getByLabelText('Billing')).toBeTruthy();
  });
});
