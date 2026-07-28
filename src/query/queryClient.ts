// Single app-wide TanStack Query client, persisted to disk via expo-sqlite's
// key-value store (AsyncStorage-compatible API, no native changes — OTA-safe).
//
// Division of labour with the axios layer in src/api/:
//   - retryOnTransient owns transient-failure retries, so queries never retry
//     (retry: false) — otherwise a flaky GET would multiply 3 axios attempts
//     by N query attempts.
//   - refreshOn401 owns auth; an 'unauthorized' ApiError reaching a query is
//     terminal for that fetch and surfaces via the session-expired event.
import { QueryClient, focusManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { AppState, type AppStateStatus } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { on } from '../api/events';

const HOUR = 60 * 60 * 1000;

// How long persisted data survives an app restart. Lists render instantly
// from this cache while a background refetch runs.
export const PERSIST_MAX_AGE_MS = 24 * HOUR;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      // Must outlive PERSIST_MAX_AGE_MS or restored entries are GC'd early.
      gcTime: 25 * HOUR,
      retry: false,
      // No NetInfo in the app; reconnect events aren't observable.
      refetchOnReconnect: false,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: Storage,
  key: 'tooltraq.query-cache.v1',
  throttleTime: 2_000,
});

// Cached queries hold org-scoped data; none of it may survive into another
// account's session. Called from logout, and below on API-layer session end.
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await queryPersister.removeClient();
}

// Terminal session end from the API layer (refresh token rejected).
on('tokens-cleared', () => {
  void clearQueryCache();
});

// Foreground/background wiring: returning to the app marks queries focused so
// stale ones revalidate. Call once at startup; returns the unsubscribe.
export function installAppFocusTracking(): () => void {
  const onChange = (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  };
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
