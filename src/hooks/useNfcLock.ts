// The org's NFC tag lock for screens. Owners/admins only — for anyone else
// it returns a null config and never makes a request.
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { NfcLockConfig } from '../api/types';
import {
  getNfcLockConfig,
  peekNfcLockConfig,
  subscribeNfcLock,
  type LockViewer,
} from '../services/nfcLockStore';

export interface UseNfcLock {
  viewer: LockViewer;
  config: NfcLockConfig | null;
  /** True once a config (or "no lock") has loaded for this session. */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useNfcLock(userId: LockViewer['userId'], isAdminOrOwner: boolean): UseNfcLock {
  const viewer = useMemo<LockViewer>(() => ({ userId, isAdminOrOwner: !!isAdminOrOwner }), [userId, isAdminOrOwner]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeNfcLock(rerender), []);

  const cached = peekNfcLockConfig(viewer);
  const needsLoad = viewer.isAdminOrOwner && cached === undefined;

  const load = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setError(null);
      try {
        await getNfcLockConfig(viewer, { force });
      } catch {
        setError("Couldn't load the NFC tag lock settings.");
      } finally {
        setLoading(false);
      }
    },
    [viewer]
  );

  useEffect(() => {
    if (needsLoad) load(false);
  }, [needsLoad, load]);

  const refresh = useCallback(() => load(true), [load]);

  return { viewer, config: cached ?? null, loaded: cached !== undefined, loading, error, refresh };
}
