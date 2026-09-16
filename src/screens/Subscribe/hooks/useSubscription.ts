import { useCallback, useState } from 'react';
import type { SubscriptionState } from '../../../api/types-billing';

export interface UseSubscriptionResult {
  state: SubscriptionState | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// DISABLED pending the billing rework: the backend /billing endpoints were
// removed, so fetching GET /billing/subscription/ only produces errors. The
// hook keeps its shape (state stays null → "No active subscription") so the
// Subscribe screen renders; restore the fetch when the new billing contract
// lands.
//
// Previous behaviour (re-enable with the new endpoint): fetch on mount and on
// the iap 'subscription.changed' event via getSubscription() from
// src/api/endpoints/billing, mapping 'unauthorized' silently and other
// failures to `error`.
export function useSubscription(): UseSubscriptionResult {
  const [state] = useState<SubscriptionState | null>(null);

  const refresh = useCallback(async () => {}, []);

  return { state, isLoading: false, error: null, refresh };
}
