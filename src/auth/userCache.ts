// Last-known UserMe, persisted so an offline/flaky app launch can restore the
// session instead of kicking a validly-signed-in user to the login screen.
// Storage is expo-sqlite's key-value store (same medium as the query cache).
import Storage from 'expo-sqlite/kv-store';
import type { UserMe } from '../api/types';

const KEY = 'tooltraq.cached-user.v1';

export async function saveCachedUser(user: UserMe): Promise<void> {
  try {
    await Storage.setItem(KEY, JSON.stringify(user));
  } catch {
    // Best effort — worst case the next offline boot falls back to login.
  }
}

export async function loadCachedUser(): Promise<UserMe | null> {
  try {
    const raw = await Storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as UserMe) : null;
  } catch {
    return null;
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    await Storage.removeItem(KEY);
  } catch {
    // Ignore — key absence is the goal.
  }
}
