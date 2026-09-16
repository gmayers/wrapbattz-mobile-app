import React from 'react';
import { render, act } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';

const mockRefreshUser = jest.fn();
// Stable references: the real context memoizes these; a fresh object per
// render would loop ProfileScreen's user-sync effect.
const mockUser = {
  first_name: 'Test',
  last_name: 'User',
  email: 'test@example.com',
  phone_number: '0123',
};
const mockAuth = {
  user: mockUser,
  userData: { role: 'owner' },
  logout: jest.fn(),
  updateUser: jest.fn(),
  refreshUser: mockRefreshUser,
  deleteAccount: jest.fn(),
};
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockTheme = {
  colors: new Proxy({}, { get: () => '#000000' }),
  themeMode: 'system',
  setThemeMode: jest.fn(),
};
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

describe('ProfileScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders from the auth context without refetching the account', async () => {
    const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
    const screen = render(<ProfileScreen navigation={navigation} />);
    await act(async () => {});
    expect(mockRefreshUser).not.toHaveBeenCalled();
    // Screen must not be stuck on its loading state.
    expect(screen.getByTestId('delete-account-button')).toBeTruthy();
  });
});
