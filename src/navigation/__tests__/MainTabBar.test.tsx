import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import MainTabBar from '../MainTabBar';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { role: 'admin' } }),
}));

const makeProps = (overrides = {}) => ({
  state: {
    index: 0,
    routes: [
      { key: 'dashboard', name: 'dashboard' },
      { key: 'tools', name: 'tools' },
      { key: 'sites', name: 'sites' },
      { key: 'settings', name: 'settings' },
    ],
  },
  descriptors: {},
  navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  ...overrides,
});

describe('MainTabBar', () => {
  it('renders 5 slots including the Scan FAB', () => {
    render(<MainTabBar {...(makeProps() as any)} onScanPress={jest.fn()} />);
    expect(screen.getByLabelText('Dashboard')).toBeTruthy();
    expect(screen.getByLabelText('Tools')).toBeTruthy();
    expect(screen.getByLabelText('Scan NFC tag')).toBeTruthy();
    expect(screen.getByLabelText('Sites')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });

  it('invokes onScanPress when FAB is tapped', () => {
    const onScanPress = jest.fn();
    render(<MainTabBar {...(makeProps() as any)} onScanPress={onScanPress} />);
    fireEvent.press(screen.getByLabelText('Scan NFC tag'));
    expect(onScanPress).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when Scan FAB is tapped', () => {
    const navigate = jest.fn();
    const props = makeProps({ navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate } });
    render(<MainTabBar {...(props as any)} onScanPress={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Scan NFC tag'));
    expect(navigate).not.toHaveBeenCalled();
  });
});
