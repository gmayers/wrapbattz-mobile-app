import React from 'react';
import { Alert } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';
import EditProfileScreen from '../EditProfileScreen';
import { requestEmailChange, confirmEmailChange } from '../../api/endpoints/account';
import { ApiError } from '../../api/errors';

jest.mock('../../api/endpoints/account', () => ({
  requestEmailChange: jest.fn(),
  confirmEmailChange: jest.fn(),
}));

const mockUser = {
  first_name: 'Test',
  last_name: 'User',
  email: 'old@example.com',
  phone_number: '0123',
};

const mockUpdateUser = jest.fn();
const mockRefreshUser = jest.fn();
const mockAuth = {
  user: mockUser,
  updateUser: mockUpdateUser,
  refreshUser: mockRefreshUser,
};
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockTheme = {
  colors: new Proxy({}, { get: () => '#000000' }),
};
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

function buildNavigation() {
  return { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };
}

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUpdateUser.mockResolvedValue(mockUser);
    mockRefreshUser.mockResolvedValue(mockUser);
  });

  it('PATCHes without an email key when the email did not change', async () => {
    const navigation = buildNavigation();
    const screen = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Save Changes'));
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({
      first_name: 'Test',
      last_name: 'User',
      phone_number: '0123',
    });
    expect(requestEmailChange).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Profile updated successfully',
      expect.any(Array)
    );
  });

  it('requests an email change and shows the code input when the email changed', async () => {
    requestEmailChange.mockResolvedValue({ requested: true });
    const navigation = buildNavigation();
    const screen = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.changeText(screen.getByPlaceholderText('Enter your email'), 'new@example.com');

    await act(async () => {
      fireEvent.press(screen.getByText('Save Changes'));
    });

    // Other fields still PATCH, still without an email key.
    expect(mockUpdateUser).toHaveBeenCalledWith({
      first_name: 'Test',
      last_name: 'User',
      phone_number: '0123',
    });
    expect(requestEmailChange).toHaveBeenCalledWith({ new_email: 'new@example.com' });
    expect(screen.getByTestId('email-code-input')).toBeTruthy();
    // Not "done" yet — confirmation is still pending.
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Success',
      'Profile updated successfully',
      expect.any(Array)
    );
  });

  it('confirms the code and refreshes the user', async () => {
    requestEmailChange.mockResolvedValue({ requested: true });
    confirmEmailChange.mockResolvedValue({ email: 'new@example.com' });
    const navigation = buildNavigation();
    const screen = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.changeText(screen.getByPlaceholderText('Enter your email'), 'new@example.com');
    await act(async () => {
      fireEvent.press(screen.getByText('Save Changes'));
    });

    fireEvent.changeText(screen.getByTestId('email-code-input'), '123456');
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-code-button'));
    });

    expect(confirmEmailChange).toHaveBeenCalledWith({ code: '123456' });
    expect(mockRefreshUser).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Profile updated successfully',
      expect.any(Array)
    );
  });

  it('shows a rate-limit error against the email field', async () => {
    requestEmailChange.mockRejectedValue(
      new ApiError({
        code: 'unknown',
        status: 429,
        message: 'Too many requests. Try again later.',
        detail: { code: 'rate_limited', message: 'Too many requests. Try again later.' },
      })
    );
    const navigation = buildNavigation();
    const screen = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.changeText(screen.getByPlaceholderText('Enter your email'), 'new@example.com');
    await act(async () => {
      fireEvent.press(screen.getByText('Save Changes'));
    });

    expect(screen.getByText('Too many requests. Try again later.')).toBeTruthy();
    // Still on the edit form — the code screen never appears.
    expect(screen.queryByTestId('email-code-input')).toBeNull();
  });

  it('shows an invalid-code error against the code field', async () => {
    requestEmailChange.mockResolvedValue({ requested: true });
    confirmEmailChange.mockRejectedValue(
      new ApiError({
        code: 'unknown',
        status: 422,
        message: 'That code is wrong.',
        detail: { code: 'invalid_code', message: 'That code is wrong.' },
      })
    );
    const navigation = buildNavigation();
    const screen = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.changeText(screen.getByPlaceholderText('Enter your email'), 'new@example.com');
    await act(async () => {
      fireEvent.press(screen.getByText('Save Changes'));
    });

    fireEvent.changeText(screen.getByTestId('email-code-input'), '000000');
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-code-button'));
    });

    expect(screen.getByText('That code is wrong.')).toBeTruthy();
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });
});
