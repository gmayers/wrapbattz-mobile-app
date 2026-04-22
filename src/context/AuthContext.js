// Compat shim — the real AuthProvider lives in src/auth/AuthContext.tsx.
// This file exists so existing `import ... from '../context/AuthContext'` keeps
// resolving during the phased migration to /api/v1/. New code should import
// from '../auth/AuthContext' and the '../api/endpoints/*' modules directly.

import { useMemo } from 'react';
import {
  AuthContext,
  AuthProvider,
  useAuth as useAuthInternal,
} from '../auth/AuthContext';
import { apiClient } from '../api/client';
import { getCached } from '../api/tokenStore';

function legacyUserData(user) {
  if (!user) return null;
  return {
    ...user,
    userId: user.id,
    orgId: user.organization?.id ?? null,
    orgName: user.organization?.name ?? null,
  };
}

/**
 * Legacy hook surface. Fields still supported:
 *   isAuthenticated, isLoading, user, userData, role, organization,
 *   isAdmin, isOwner, isAdminOrOwner, onboardingComplete,
 *   login, logout, register, verifyEmail, forgotPassword, resetPassword,
 *   refreshUser, updateUser, updateOnboarding, getAccessToken, axiosInstance.
 *
 * Removed — will throw or be undefined. Rewrite callers to use:
 *   src/api/endpoints/* (tools, sites, assignments, incidents, feedback, …)
 *   src/api/client#apiClient for raw axios access
 */
export function useAuth() {
  const ctx = useAuthInternal();
  return useMemo(
    () => ({
      ...ctx,
      userData: legacyUserData(ctx.user),
      axiosInstance: apiClient,
      getAccessToken: async () => getCached()?.accessToken ?? null,
      requestPasswordReset: (email) => ctx.forgotPassword({ email }),
    }),
    [ctx]
  );
}

export { AuthContext, AuthProvider };
