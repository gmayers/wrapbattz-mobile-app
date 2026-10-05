// src/services/nfcLockStore.ts — the organisation's NFC tag lock, for this session.
//
// The lock code lives in memory only: never AsyncStorage/SecureStore, never
// the persisted React Query cache, never a log line. It's fetched only for
// owners/admins (the endpoint 403s everyone else), dropped on sign-out, and
// refetched when the app comes back to the foreground.
import { AppState, type AppStateStatus } from 'react-native';
import * as organizationsApi from '../api/endpoints/organizations';
import { on } from '../api/events';
import { ApiError } from '../api/errors';
import type { NfcLockConfig } from '../api/types';
import { toTagKey, type TagLockKeys } from './NFCSecurityService';

export interface LockViewer {
  userId: number | string | null | undefined;
  isAdminOrOwner: boolean;
}

export const ONLY_ADMINS_MESSAGE = 'Only owners and admins can rewrite locked tags';
export const LOCK_UNAVAILABLE_MESSAGE =
  "Couldn't load your organisation's NFC tag lock code. Check your connection and try again.";

interface Entry<T> {
  owner: string;
  value: T;
  stale: boolean;
}

let lockEntry: Entry<NfcLockConfig | null> | null = null;
let lockInflight: { owner: string; promise: Promise<NfcLockConfig | null> } | null = null;
let orgFlagEntry: Entry<boolean> | null = null;
const listeners = new Set<() => void>();
let installed = false;
let appState: AppStateStatus | undefined;

const ownerKey = (viewer: LockViewer) => String(viewer.userId ?? '');

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // a listener's failure is its own problem
    }
  });
}

function install() {
  if (installed) return;
  installed = true;
  appState = AppState.currentState;
  AppState.addEventListener('change', (next) => {
    if (next === 'active' && appState !== 'active') {
      if (lockEntry) lockEntry.stale = true;
      if (orgFlagEntry) orgFlagEntry.stale = true;
      notify();
    }
    appState = next;
  });
  on('tokens-cleared', () => clearNfcLockCache());
  on('session-expired', () => clearNfcLockCache());
}

export function subscribeNfcLock(fn: () => void): () => void {
  install();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function clearNfcLockCache(): void {
  lockEntry = null;
  lockInflight = null;
  orgFlagEntry = null;
  notify();
}

/** The cached config for this viewer (undefined = not loaded or stale). */
export function peekNfcLockConfig(viewer: LockViewer): NfcLockConfig | null | undefined {
  if (!viewer.isAdminOrOwner || !lockEntry || lockEntry.owner !== ownerKey(viewer) || lockEntry.stale) {
    return undefined;
  }
  return lockEntry.value;
}

/** Store a config returned by PUT/DELETE so the app uses the new code at once. */
export function setNfcLockConfig(viewer: LockViewer, config: NfcLockConfig): void {
  install();
  lockEntry = { owner: ownerKey(viewer), value: config, stale: false };
  orgFlagEntry = { owner: ownerKey(viewer), value: !!config.enabled, stale: false };
  notify();
}

/**
 * The org's lock config — owners/admins only; resolves null for everyone
 * else without making a request. Also null when the server doesn't offer
 * the endpoint yet (404).
 */
export async function getNfcLockConfig(
  viewer: LockViewer,
  opts: { force?: boolean } = {}
): Promise<NfcLockConfig | null> {
  if (!viewer.isAdminOrOwner) return null;
  install();
  const owner = ownerKey(viewer);
  if (!opts.force && lockEntry && lockEntry.owner === owner && !lockEntry.stale) return lockEntry.value;
  if (lockInflight && lockInflight.owner === owner) return lockInflight.promise;

  const promise = (async () => {
    try {
      const config = await organizationsApi.getNfcLock();
      if (lockInflight?.promise === promise) {
        lockEntry = { owner, value: config, stale: false };
      }
      return config;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not_found') {
        if (lockInflight?.promise === promise) lockEntry = { owner, value: null, stale: false };
        return null;
      }
      throw err;
    } finally {
      if (lockInflight?.promise === promise) lockInflight = null;
      notify();
    }
  })();
  lockInflight = { owner, promise };
  return promise;
}

/** Whether tags are locked — the safe-for-everyone flag from GET /organizations/me/. */
async function getOrgLockEnabled(viewer: LockViewer): Promise<boolean> {
  install();
  const owner = ownerKey(viewer);
  if (orgFlagEntry && orgFlagEntry.owner === owner && !orgFlagEntry.stale) return orgFlagEntry.value;
  const org = await organizationsApi.getMyOrganization();
  orgFlagEntry = { owner, value: !!org.nfc_lock_enabled, stale: false };
  return orgFlagEntry.value;
}

/** Tag passwords from a config, or null when there's no code at all. */
export function keysFromConfig(config: NfcLockConfig | null | undefined): TagLockKeys | null {
  if (!config) return null;
  const current = config.enabled ? toTagKey(config.password_hex, config.pack_hex) : null;
  const previous = toTagKey(config.previous_password_hex, config.previous_pack_hex);
  if (!current && !previous) return null;
  return { enabled: !!current, current, previous };
}

export interface TagWritePermission {
  /** False → don't write; show `message`. */
  ok: boolean;
  lock: TagLockKeys | null;
  message?: string;
}

/**
 * Call before any tag write/erase. Owners/admins get the keys to pass as
 * `{ lock }` (null when the org has never set a code). Other roles never get
 * a code; on a locked org they get a message instead of a write.
 */
export async function resolveTagLockForWrite(viewer: LockViewer): Promise<TagWritePermission> {
  if (viewer.isAdminOrOwner) {
    try {
      return { ok: true, lock: keysFromConfig(await getNfcLockConfig(viewer)) };
    } catch {
      return { ok: false, lock: null, message: LOCK_UNAVAILABLE_MESSAGE };
    }
  }
  try {
    if (await getOrgLockEnabled(viewer)) return { ok: false, lock: null, message: ONLY_ADMINS_MESSAGE };
  } catch {
    // Unknown: let the write try. A locked tag rejects it anyway.
  }
  return { ok: true, lock: null };
}
