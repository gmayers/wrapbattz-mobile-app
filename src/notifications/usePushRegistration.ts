import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { syncPushRegistration } from './pushRegistration';

// Re-runs whenever the signed-in user or active organisation changes.
export function usePushRegistration(): void {
  const { isAuthenticated, user, organization } = useAuth();
  const userId = user?.id ?? null;
  const orgId = organization?.id ?? null;

  useEffect(() => {
    if (!isAuthenticated || userId == null || orgId == null) return;
    void syncPushRegistration({ userId, orgId });
  }, [isAuthenticated, userId, orgId]);
}
