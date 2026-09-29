import { useCallback, useEffect, useRef, useState } from 'react';

import { isBillingUnavailable } from '../../../api/billingErrors';
import { getSubscription } from '../../../api/endpoints/billing';
import type { SubscriptionState } from '../../../api/types-billing';
import { iapEvents } from '../../../iap/events';

export interface UseSubscriptionResult {
  state: SubscriptionState | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * The org's subscription as GET /billing/subscription sees it.
 *
 * `state` stays null both for "no subscription" and for "billing is not
 * available here" — the screen renders the same empty state either way, so
 * only errors the user could act on are surfaced through `error`.
 */
export function useSubscription(): UseSubscriptionResult {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await getSubscription();
      if (!mounted.current) return;
      setState(next);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setState(null);
      // A missing/disabled billing surface is an empty state, not an error.
      setError(isBillingUnavailable(e) ? null : 'Could not load your subscription.');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    // A purchase or restore rewrites the subscription server-side; refetch so
    // the screen reflects it without the user pulling to refresh.
    const off = iapEvents.on('subscription.changed', () => {
      void refresh();
    });
    return () => {
      mounted.current = false;
      off();
    };
  }, [refresh]);

  return { state, isLoading, error, refresh };
}
