import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as auth from '../../api/endpoints/auth';
import * as account from '../../api/endpoints/account';
import { apiEvents, tokenStore } from '../../api';
import { clearQueryCache } from '../../query/queryClient';
import { clearCachedUser } from '../userCache';
import { AuthProvider, useAuth } from '../AuthContext';

const mockUnregister = jest.fn(async () => undefined);
jest.mock('../../notifications/pushRegistration', () => ({
  unregisterPush: () => mockUnregister(),
}));

const mockCleanup = jest.fn(async () => undefined);
jest.mock('../../notifications/signOutCleanup', () => ({
  clearNotificationStateOnSignOut: () => mockCleanup(),
}));

jest.mock('../../api/endpoints/auth', () => ({
  logout: jest.fn(async () => undefined),
}));
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

const TOKENS = { accessToken: 'a', refreshToken: 'r', expiresAt: null };

function Probe({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const authCtx = useAuth();
  onAuth(authCtx);
  return <Text testID="probe">{authCtx.status}</Text>;
}

async function renderSignedIn(): Promise<ReturnType<typeof useAuth>> {
  (tokenStore.hydrate as jest.Mock).mockResolvedValue(TOKENS);
  (account.getMeBootstrap as jest.Mock).mockResolvedValue({
    email: 'me@example.com',
    has_completed_onboarding: true,
  });

  let captured: ReturnType<typeof useAuth> | undefined;
  const screen = render(
    <AuthProvider>
      <Probe onAuth={(a) => (captured = a)} />
    </AuthProvider>
  );
  await waitFor(() => expect(captured!.status).toBe('authenticated'));
  return captured!;
}

describe('AuthContext logout push unregistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnregister.mockReset();
    mockUnregister.mockImplementation(async () => undefined);
    mockCleanup.mockReset();
    mockCleanup.mockImplementation(async () => undefined);
  });

  it('unregister before logout', async () => {
    const calls: string[] = [];
    mockUnregister.mockImplementation(async () => {
      calls.push('unregister');
    });
    (auth.logout as jest.Mock).mockImplementation(async () => {
      calls.push('logout');
    });
    const ctx = await renderSignedIn();
    await act(() => ctx.logout());
    expect(calls).toEqual(['unregister', 'logout']);
  });

  it('logout still succeeds when unregister fails', async () => {
    mockUnregister.mockRejectedValue(new Error('offline'));
    const ctx = await renderSignedIn();
    await act(() => ctx.logout());
    expect(auth.logout).toHaveBeenCalled();
  });

  it('logout clears local notification state after unregistering', async () => {
    const calls: string[] = [];
    mockUnregister.mockImplementation(async () => {
      calls.push('unregister');
    });
    mockCleanup.mockImplementation(async () => {
      calls.push('cleanup');
    });
    (auth.logout as jest.Mock).mockImplementation(async () => {
      calls.push('logout');
    });
    const ctx = await renderSignedIn();
    await act(() => ctx.logout());
    expect(calls).toEqual(['unregister', 'cleanup', 'logout']);
  });

  it('session-expired clears local notification state', async () => {
    await renderSignedIn();
    const call = (apiEvents.on as jest.Mock).mock.calls.find(([name]) => name === 'session-expired');
    expect(call).toBeDefined();
    act(() => call![1]());
    await waitFor(() => expect(mockCleanup).toHaveBeenCalledTimes(1));
  });

  it('deleteAccount unregisters push first, then clears everything local', async () => {
    const calls: string[] = [];
    mockUnregister.mockImplementation(async () => {
      calls.push('unregister');
    });
    (account.deleteAccount as jest.Mock).mockImplementation(async () => {
      calls.push('delete');
    });
    const ctx = await renderSignedIn();
    await act(() => ctx.deleteAccount());
    expect(calls).toEqual(['unregister', 'delete']);
    expect(tokenStore.clear).toHaveBeenCalled();
    expect(clearQueryCache).toHaveBeenCalled();
    expect(clearCachedUser).toHaveBeenCalled();
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });
});
