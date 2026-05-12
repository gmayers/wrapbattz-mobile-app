import { useCallback, useEffect, useState } from 'react';
import { getSubscription } from '../../../api/endpoints/billing';
import { ApiError } from '../../../api/errors';
import type { SubscriptionState } from '../../../api/types-billing';
import { iapEvents } from '../../../iap';

export interface UseSubscriptionResult {
  state: SubscriptionState | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await getSubscription();
      setState(next);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') return;
      setError(e instanceof Error ? e.message : 'Failed to load subscription.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const off = iapEvents.on('subscription.changed', () => {
      refresh();
    });
    return off;
  }, [refresh]);

  return { state, isLoading, error, refresh };
}
