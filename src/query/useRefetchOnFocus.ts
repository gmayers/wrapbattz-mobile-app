import { useEffect, useRef } from 'react';

// Bottom-tab screens stay mounted, so useQuery's refetchOnMount never re-runs
// when the user returns to a tab. This hook refetches on navigation focus —
// but only when the query is actually stale, so tab bouncing inside staleTime
// costs zero requests (and cached data stays on screen either way).
export function useRefetchOnFocus(
  navigation: { addListener: (event: 'focus', cb: () => void) => () => void },
  query: { refetch: () => unknown; isStale: boolean }
): void {
  const ref = useRef(query);
  ref.current = query;
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        if (ref.current.isStale) ref.current.refetch();
      }),
    [navigation]
  );
}
