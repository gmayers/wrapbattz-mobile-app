import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as auth from '../api/endpoints/auth';
import * as account from '../api/endpoints/account';
import {
  disableBiometricUnlock as qaDisableBiometric,
  disablePinUnlock as qaDisablePin,
  enableBiometricUnlock as qaEnableBiometric,
  enablePinUnlock as qaEnablePin,
  loginWithStoredCredentials as qaLoginWithStoredCredentials,
} from './quickAuth';
import { apiEvents, tokenStore } from '../api';
import type {
  ForgotPasswordRequest,
  OnboardingUpdate,
  OrganizationSummary,
  RegisterRequest,
  ResetPasswordRequest,
  UserMe,
  UserUpdate,
  VerifyEmailRequest,
  VerifyPendingResponse,
} from '../api/types';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: Status;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserMe | null;
  role: string | null;
  organization: OrganizationSummary | null;
  isOwner: boolean;
  isAdmin: boolean;
  isAdminOrOwner: boolean;
  onboardingComplete: boolean;

  login: (email: string, password: string) => Promise<UserMe>;
  logout: () => Promise<void>;
  register: (payload: RegisterRequest) => Promise<VerifyPendingResponse>;
  verifyEmail: (payload: VerifyEmailRequest) => Promise<UserMe>;
  forgotPassword: (payload: ForgotPasswordRequest) => Promise<void>;
  resetPassword: (payload: ResetPasswordRequest) => Promise<void>;
  refreshUser: () => Promise<UserMe | null>;
  updateUser: (payload: UserUpdate) => Promise<UserMe>;
  updateOnboarding: (payload: OnboardingUpdate) => Promise<UserMe>;

  loginWithStoredCredentials: () => Promise<UserMe>;
  enableBiometricUnlock: () => Promise<void>;
  disableBiometricUnlock: () => Promise<void>;
  enablePinUnlock: (pin: string) => Promise<void>;
  disablePinUnlock: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<UserMe | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyUser = useCallback((next: UserMe | null) => {
    if (!mounted.current) return;
    setUser(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
  }, []);

  const bootstrap = useCallback(async () => {
    const tokens = await tokenStore.hydrate();
    if (!tokens) {
      applyUser(null);
      return;
    }
    try {
      const me = await account.getMe();
      applyUser(me);
    } catch {
      await tokenStore.clear();
      applyUser(null);
    }
  }, [applyUser]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const off = apiEvents.on('session-expired', () => {
      applyUser(null);
    });
    return off;
  }, [applyUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await auth.login({ email, password });
      applyUser(response.user);
      return response.user;
    },
    [applyUser]
  );

  const logout = useCallback(async () => {
    await auth.logout();
    applyUser(null);
  }, [applyUser]);

  const register = useCallback(
    (payload: RegisterRequest) => auth.register(payload),
    []
  );

  const verifyEmail = useCallback(
    async (payload: VerifyEmailRequest) => {
      const response = await auth.verifyEmail(payload);
      applyUser(response.user);
      return response.user;
    },
    [applyUser]
  );

  const forgotPassword = useCallback(
    (payload: ForgotPasswordRequest) => auth.forgotPassword(payload),
    []
  );

  const resetPassword = useCallback(
    (payload: ResetPasswordRequest) => auth.resetPassword(payload),
    []
  );

  const refreshUser = useCallback(async () => {
    try {
      const me = await account.getMe();
      applyUser(me);
      return me;
    } catch {
      return null;
    }
  }, [applyUser]);

  const updateUser = useCallback(
    async (payload: UserUpdate) => {
      const me = await account.updateMe(payload);
      applyUser(me);
      return me;
    },
    [applyUser]
  );

  const updateOnboarding = useCallback(
    async (payload: OnboardingUpdate) => {
      const me = await account.updateOnboarding(payload);
      applyUser(me);
      return me;
    },
    [applyUser]
  );

  const loginWithStoredCredentials = useCallback(async () => {
    const response = await qaLoginWithStoredCredentials();
    applyUser(response.user);
    return response.user;
  }, [applyUser]);

  const enableBiometricUnlock = useCallback(async () => {
    const tokens = tokenStore.getCached();
    if (!tokens?.refreshToken || !user?.email) {
      throw new Error('Sign in before enabling biometric unlock.');
    }
    await qaEnableBiometric(tokens.refreshToken, user.email);
  }, [user]);

  const disableBiometricUnlock = useCallback(() => qaDisableBiometric(), []);

  const enablePinUnlock = useCallback(
    async (pin: string) => {
      const tokens = tokenStore.getCached();
      if (!tokens?.refreshToken || !user?.email) {
        throw new Error('Sign in before enabling PIN unlock.');
      }
      await qaEnablePin(pin, tokens.refreshToken, user.email);
    },
    [user]
  );

  const disablePinUnlock = useCallback(() => qaDisablePin(), []);

  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role ?? null;
    const isOwner = role === 'owner';
    const isAdmin = role === 'admin';
    return {
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      user,
      role,
      organization: user?.organization ?? null,
      isOwner,
      isAdmin,
      isAdminOrOwner: isOwner || isAdmin,
      onboardingComplete: user?.has_completed_onboarding ?? false,

      login,
      logout,
      register,
      verifyEmail,
      forgotPassword,
      resetPassword,
      refreshUser,
      updateUser,
      updateOnboarding,

      loginWithStoredCredentials,
      enableBiometricUnlock,
      disableBiometricUnlock,
      enablePinUnlock,
      disablePinUnlock,
    };
  }, [
    status,
    user,
    login,
    logout,
    register,
    verifyEmail,
    forgotPassword,
    resetPassword,
    refreshUser,
    updateUser,
    updateOnboarding,
    loginWithStoredCredentials,
    enableBiometricUnlock,
    disableBiometricUnlock,
    enablePinUnlock,
    disablePinUnlock,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export { AuthContext };
