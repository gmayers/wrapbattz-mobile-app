import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ApiError } from '../../api/errors';
import * as account from '../../api/endpoints/account';
import { tokenStore } from '../../api';
import { loadCachedUser, clearCachedUser } from '../userCache';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('../../api/endpoints/auth', () => ({}));
jest.mock('../../api/endpoints/account', () => ({
  getMeBootstrap: jest.fn(),
  getMe: jest.fn(),
  updateMe: jest.fn(),
  updateOnboarding: jest.fn(),
  deleteAccount: jest.fn(),
}));
jest.mock('../googleSignIn', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('../quickAuth', () => ({
  disableBiometricUnlock: jest.fn(),
  disablePinUnlock: jest.fn(),
  enableBiometricUnlock: jest.fn(),
  enablePinUnlock: jest.fn(),
  loginWithStoredCredentials: jest.fn(),
}));
jest.mock('../../api', () => ({
  apiEvents: { on: jest.fn(() => () => {}) },
  tokenStore: {
    hydrate: jest.fn(),
    clear: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('../../query/queryClient', () => ({
  clearQueryCache: jest.fn(() => Promise.resolve()),
}));
jest.mock('../userCache', () => ({
  saveCachedUser: jest.fn(() => Promise.resolve()),
  loadCachedUser: jest.fn(() => Promise.resolve(null)),
  clearCachedUser: jest.fn(() => Promise.resolve()),
}));

function Probe() {
  const { status, user } = useAuth();
  return <Text testID="probe">{`${status}|${user?.email ?? 'none'}`}</Text>;
}

const TOKENS = { accessToken: 'a', refreshToken: 'r', expiresAt: null };

describe('AuthContext bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tokenStore.hydrate as jest.Mock).mockResolvedValue(TOKENS);
  });

  it('stays signed in from the cached profile when bootstrap fails on network', async () => {
    (account.getMeBootstrap as jest.Mock).mockRejectedValue(
      new ApiError({ code: 'network', message: 'offline' })
    );
    (loadCachedUser as jest.Mock).mockResolvedValue({ email: 'cached@example.com' });

    const screen = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await act(async () => {});

    expect(screen.getByTestId('probe').props.children).toBe(
      'authenticated|cached@example.com'
    );
    // A network failure is NOT an auth rejection — the tokens must survive.
    expect(tokenStore.clear).not.toHaveBeenCalled();
  });

  it('signs out (and clears tokens) only when the server rejects the session', async () => {
    (account.getMeBootstrap as jest.Mock).mockRejectedValue(
      new ApiError({ code: 'unauthorized', status: 401, message: 'nope' })
    );

    const screen = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await act(async () => {});

    expect(screen.getByTestId('probe').props.children).toBe('unauthenticated|none');
    expect(tokenStore.clear).toHaveBeenCalled();
    expect(clearCachedUser).toHaveBeenCalled();
  });
});
