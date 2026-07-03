import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHANGELOG_VERSION } from '@/constants/changelog';

const KEY = 'whatsnew:lastSeenVersion';

export function isNewer(current: string, seen: string | null): boolean {
  if (!seen) return true;
  const c = current.split('.').map(Number);
  const s = seen.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, s.length); i++) {
    const a = c[i] ?? 0, b = s[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

export function useWhatsNew() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((seen) => { if (isNewer(CHANGELOG_VERSION, seen)) setVisible(true); })
      .catch(() => {});
  }, []);
  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(KEY, CHANGELOG_VERSION).catch(() => {});
  }, []);
  const openManually = useCallback(() => setVisible(true), []);
  return { visible, dismiss, openManually };
}
