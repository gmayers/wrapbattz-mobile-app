# Notifications (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register the phone for Expo push, show and route notifications (foreground, background, cold start), give every role a notification inbox behind the dashboard bell with a live unread dot, and let users (and owners/admins for their organisation) manage notification preferences.

**Architecture:** A `src/notifications/` module owns everything: API calls in `src/api/endpoints/notifications.ts`, TanStack Query hooks, a push-registration service called from `AuthContext`, a `NotificationsBridge` component that installs Expo handlers and routes taps through a shared `navigationRef`, and two new screens (`Notifications`, `NotificationSettings`) on the main stack.

**Tech Stack:** Expo SDK 54, React Native 0.81, React Navigation 7 (stack), `@tanstack/react-query` 5 (persisted client), `expo-notifications` ~0.32, `expo-application`, Jest + `@testing-library/react-native` 12 (ts-jest).

**Spec:** backend repo `docs/superpowers/specs/2026-09-24-notification-delivery-design.md` (§3 Mobile API, §4 Mobile app). Link kinds were narrowed during planning to `tool | join_request` (spec §3 amendment).

**Depends on:** backend plan `docs/superpowers/plans/2026-09-24-notification-delivery-backend.md` Task 14 (its `docs/api/openapi.json`). The backend branch is `feat/notification-delivery` in `gmayers/tooltraq`.

## Global Constraints

- Branch `feat/notifications` from `feat/perf-optimizations`, in its own worktree. Never touch the main checkout's uncommitted billing edits.
- New code imports auth from `src/auth/AuthContext` (not the `src/context/AuthContext.js` shim) and HTTP from `src/api/endpoints/*`.
- API paths (all relative to `API_BASE_URL`): `/account/notifications/`, `/account/notifications/unread-count/`, `/account/notifications/mark-all-read/`, `/account/notifications/{id}/`, `/account/notification-preferences/`, `/organizations/me/notification-policy/`, `/account/push-tokens/`. Trailing slashes required.
- Query keys: `['notifications', 'feed', status]`, `['notifications', 'unread-count']`, `['notifications', 'preferences']`, `['notifications', 'policy']`. Every mutation invalidates `['notifications']`.
- Unread count polls every `60_000` ms while the app is foregrounded.
- AsyncStorage key for the last registered push token: `notifications.pushRegistration.v1`.
- Android notification channel id: `default` (matches the backend).
- Screen route names: `Notifications`, `NotificationSettings`. The existing `NotificationPreferences` (billing) route stays registered.
- Native changes (plugin, permission, `googleServicesFile`) need a new EAS build; they are not OTA-deliverable.

## Review Focus

1. **Permission denied or simulator** — registration must quietly do nothing (no error UI, no POST) and the inbox must still work. Tests in Task 3 (`skips when permission denied`, `skips when no token`).
2. **Logout on a shared phone** — the token must be deleted server-side *before* the session is cleared, and a failed delete must not block logout. Tests in Task 3 (`unregister before logout`, `logout still succeeds when unregister fails`).
3. **Tapping a push for a tool that has been deleted, or with no link** — must land on the inbox, not a crash or blank screen. Tests in Task 4 (`unknown kind → inbox`, `null link → inbox`) and Task 6 (`tap with no link opens inbox`).
4. **Cold start from a notification tap** before navigation is ready — the tap must be replayed once navigation mounts, exactly once. Test in Task 6 (`cold start replays once when ready`).
5. **A worker whose organisation disabled push opt-outs** — switches show disabled with the reason; saving never sends a change to a non-editable value. Test in Task 8 (`disabled rows cannot be toggled`).

---

## File map

| File | Responsibility |
|---|---|
| `app.json` (modify) | expo-notifications plugin, Android permission, googleServicesFile |
| `jest.setup.js` (modify) | Global mocks for expo-notifications / expo-device / expo-application |
| `docs/api/openapi.json`, `src/api/generated/schema.ts`, `src/api/types.ts` (modify) | Contract sync |
| `src/api/endpoints/notifications.ts` (create) | All notification HTTP calls |
| `src/api/endpoints/account.ts` (modify) | Remove the old untyped notification calls |
| `src/notifications/pushRegistration.ts` (create) | Register/unregister the Expo token with the backend |
| `src/notifications/usePushRegistration.ts` (create) | Run registration when the signed-in user/org changes |
| `src/navigation/navigationRef.ts` (create) | Shared navigation container ref |
| `src/notifications/linkRouting.ts` (create) | Map a notification link to a route |
| `src/notifications/queries.ts` (create) | Query/mutation hooks |
| `src/notifications/NotificationsBridge.tsx` (create) | Expo handlers, listeners, tap routing |
| `src/screens/Notifications/NotificationsScreen.tsx` (create) | Inbox |
| `src/screens/Notifications/NotificationSettingsScreen.tsx` (create) | Preferences + org defaults |
| `src/auth/AuthContext.tsx`, `src/navigation/index.tsx`, dashboard screens, `quickActions.ts`, `sections.ts`, `ProfileScreen.js` (modify) | Wiring |

---

### Task 1: Native config, dependency and test mocks

**Files:**
- Modify: `app.json`
- Modify: `package.json`, `package-lock.json` (via `npx expo install`)
- Modify: `jest.setup.js`
- Test: `src/notifications/__tests__/appConfig.test.ts`

**Interfaces:**
- Produces: global Jest mocks for `expo-notifications`, `expo-device`, `expo-application` that every later test relies on (`Notifications.getPermissionsAsync`, `requestPermissionsAsync`, `getExpoPushTokenAsync`, `setNotificationHandler`, `setNotificationChannelAsync`, `addNotificationReceivedListener`, `addNotificationResponseReceivedListener`, `getLastNotificationResponseAsync`, `setBadgeCountAsync`, `AndroidImportance`; `Device.isDevice = true`; `Application.getAndroidId()`, `Application.getIosIdForVendorAsync()`).

- [ ] **Step 1: Install dependencies in the worktree**

Run: `npm ci && npx expo install expo-application`
Expected: `expo-application` appears in `package.json` dependencies with an SDK-54-compatible version.

- [ ] **Step 2: Write the failing test**

`src/notifications/__tests__/appConfig.test.ts`:

```ts
import appJson from '../../../app.json';

describe('app.json notification config', () => {
  const expo: any = (appJson as any).expo;

  it('registers the expo-notifications plugin with the default channel', () => {
    const entry = expo.plugins.find(
      (p: any) => (Array.isArray(p) ? p[0] : p) === 'expo-notifications'
    );
    expect(entry).toBeDefined();
    expect(entry[1]).toMatchObject({ defaultChannel: 'default' });
  });

  it('declares the Android 13 notification permission and FCM config', () => {
    expect(expo.android.permissions).toContain('android.permission.POST_NOTIFICATIONS');
    expect(expo.android.googleServicesFile).toBe('./google-services.json');
  });
});
```

Add `"resolveJsonModule": true` to `tsconfig.json` `compilerOptions` if the import fails to compile, and add the same key to the ts-jest `tsconfig` object in `package.json`'s `jest.transform`.

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/notifications/__tests__/appConfig.test.ts`
Expected: FAIL — plugin entry undefined.

- [ ] **Step 4: Edit `app.json`**

Append to `expo.plugins`:

```json
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#FFC72C",
          "defaultChannel": "default"
        }
      ]
```

Add `"android.permission.POST_NOTIFICATIONS"` to `expo.android.permissions`, and `"googleServicesFile": "./google-services.json"` to `expo.android`. `google-services.json` comes from the owner's Firebase project (Task 10). Until it exists, EAS Android builds fail, but tests and iOS builds are unaffected.

- [ ] **Step 5: Global mocks in `jest.setup.js`** (append)

```js
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  setBadgeCountAsync: jest.fn(async () => true),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-application', () => ({
  getAndroidId: jest.fn(() => 'android-id-1'),
  getIosIdForVendorAsync: jest.fn(async () => 'ios-vendor-1'),
}));
```

- [ ] **Step 6: Run tests**

Run: `npm test -- src/notifications/__tests__/appConfig.test.ts && npm test`
Expected: PASS; the full suite is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app.json package.json package-lock.json jest.setup.js tsconfig.json src/notifications/__tests__/appConfig.test.ts
git commit -m "feat(notifications): expo-notifications config, expo-application, test mocks"
```

---

### Task 2: API contract and endpoint module

**Files:**
- Modify: `docs/api/openapi.json` (copy from backend), `src/api/generated/schema.ts` (regenerate), `src/api/types.ts`
- Create: `src/api/endpoints/notifications.ts`
- Modify: `src/api/endpoints/account.ts` (delete `listNotifications`, `markNotification`), `src/api/endpoints/index.ts` (export)
- Test: `src/api/endpoints/__tests__/notifications.test.ts`

**Interfaces:**
- Produces (types in `src/api/types.ts`): `NotificationRead` (now with `link?: NotificationLink | null`), `NotificationLink`, `PagedNotifications`, `UnreadCount`, `MarkAllReadResult`, `UserPreferences`, `TypePreference`, `ChannelState`, `OrgPolicy`, `OrgPolicyUpdate`, `TypePolicy`.
- Produces (functions in `src/api/endpoints/notifications.ts`):
  - `listNotifications(params: { status?: 'all' | 'unread'; cursor?: string | null; limit?: number }) => Promise<PagedNotifications>`
  - `getUnreadCount() => Promise<number>`
  - `markNotificationRead(id: number, read?: boolean) => Promise<NotificationRead>`
  - `markAllNotificationsRead() => Promise<number>`
  - `getNotificationPreferences() => Promise<UserPreferences>`
  - `updateNotificationPreferences(payload: UserPreferences) => Promise<UserPreferences>`
  - `getNotificationPolicy() => Promise<OrgPolicy>`
  - `updateNotificationPolicy(payload: OrgPolicyUpdate) => Promise<OrgPolicy>`

- [ ] **Step 1: Sync the contract**

Copy the backend's regenerated spec (backend plan Task 14) over the mobile copy, then regenerate types:

```bash
git -C <backend repo> show feat/notification-delivery:docs/api/openapi.json > docs/api/openapi.json
npm run api:types
```

Expected: `src/api/generated/schema.ts` gains `PagedNotifications`, `NotificationLink`, `UnreadCount`, `MarkAllReadResult`, `UserPreferences`, `TypePreference`, `ChannelState`, `MasterSwitches`, `OrgPolicy`, `OrgPolicyUpdate`, `TypePolicy`.

- [ ] **Step 2: Add type aliases** in `src/api/types.ts`, directly after `NotificationMarkReadRequest`:

```ts
export type NotificationLink = S['NotificationLink'];
export type PagedNotifications = S['PagedNotifications'];
export type UnreadCount = S['UnreadCount'];
export type MarkAllReadResult = S['MarkAllReadResult'];
export type ChannelState = S['ChannelState'];
export type TypePreference = S['TypePreference'];
export type UserPreferences = S['UserPreferences'];
export type TypePolicy = S['TypePolicy'];
export type OrgPolicy = S['OrgPolicy'];
export type OrgPolicyUpdate = S['OrgPolicyUpdate'];
```

- [ ] **Step 3: Write the failing tests**

`src/api/endpoints/__tests__/notifications.test.ts`:

```ts
import { apiClient } from '../../client';
import * as n from '../notifications';

jest.mock('../../client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn() },
}));

describe('notifications endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists with status and cursor, omitting empty params', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { items: [], next_cursor: null, prev_cursor: null } });
    await n.listNotifications({ status: 'unread', cursor: 'abc', limit: 20 });
    expect(apiClient.get).toHaveBeenCalledWith('/account/notifications/', {
      params: { status: 'unread', cursor: 'abc', limit: 20 },
    });
    await n.listNotifications({});
    expect(apiClient.get).toHaveBeenLastCalledWith('/account/notifications/', { params: {} });
  });

  it('unwraps the unread count', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { count: 4 } });
    await expect(n.getUnreadCount()).resolves.toBe(4);
    expect(apiClient.get).toHaveBeenCalledWith('/account/notifications/unread-count/');
  });

  it('marks one and all read', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { id: 3, is_read: true } });
    await n.markNotificationRead(3);
    expect(apiClient.patch).toHaveBeenCalledWith('/account/notifications/3/', { read: true });
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { updated: 7 } });
    await expect(n.markAllNotificationsRead()).resolves.toBe(7);
    expect(apiClient.post).toHaveBeenCalledWith('/account/notifications/mark-all-read/');
  });

  it('reads and writes preferences and policy', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { master: {}, types: [] } });
    (apiClient.put as jest.Mock).mockResolvedValue({ data: { master: {}, types: [] } });
    await n.getNotificationPreferences();
    await n.updateNotificationPreferences({ master: { push: true, email: false }, types: [] } as any);
    await n.getNotificationPolicy();
    await n.updateNotificationPolicy({ digest_minutes: 30 } as any);
    expect(apiClient.get).toHaveBeenCalledWith('/account/notification-preferences/');
    expect(apiClient.put).toHaveBeenCalledWith('/account/notification-preferences/', {
      master: { push: true, email: false }, types: [],
    });
    expect(apiClient.get).toHaveBeenCalledWith('/organizations/me/notification-policy/');
    expect(apiClient.put).toHaveBeenCalledWith('/organizations/me/notification-policy/', { digest_minutes: 30 });
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test -- src/api/endpoints/__tests__/notifications.test.ts`
Expected: FAIL — `Cannot find module '../notifications'`.

- [ ] **Step 5: Implement `src/api/endpoints/notifications.ts`**

```ts
import { apiClient } from '../client';
import type {
  MarkAllReadResult,
  NotificationRead,
  OrgPolicy,
  OrgPolicyUpdate,
  PagedNotifications,
  UnreadCount,
  UserPreferences,
} from '../types';

export interface ListNotificationsParams {
  status?: 'all' | 'unread';
  cursor?: string | null;
  limit?: number;
}

export async function listNotifications(
  params: ListNotificationsParams
): Promise<PagedNotifications> {
  const query: Record<string, string | number> = {};
  if (params.status) query.status = params.status;
  if (params.cursor) query.cursor = params.cursor;
  if (params.limit) query.limit = params.limit;
  const { data } = await apiClient.get<PagedNotifications>('/account/notifications/', {
    params: query,
  });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<UnreadCount>('/account/notifications/unread-count/');
  return data.count;
}

export async function markNotificationRead(id: number, read = true): Promise<NotificationRead> {
  const { data } = await apiClient.patch<NotificationRead>(`/account/notifications/${id}/`, {
    read,
  });
  return data;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await apiClient.post<MarkAllReadResult>(
    '/account/notifications/mark-all-read/'
  );
  return data.updated;
}

export async function getNotificationPreferences(): Promise<UserPreferences> {
  const { data } = await apiClient.get<UserPreferences>('/account/notification-preferences/');
  return data;
}

export async function updateNotificationPreferences(
  payload: UserPreferences
): Promise<UserPreferences> {
  const { data } = await apiClient.put<UserPreferences>(
    '/account/notification-preferences/',
    payload
  );
  return data;
}

export async function getNotificationPolicy(): Promise<OrgPolicy> {
  const { data } = await apiClient.get<OrgPolicy>('/organizations/me/notification-policy/');
  return data;
}

export async function updateNotificationPolicy(payload: OrgPolicyUpdate): Promise<OrgPolicy> {
  const { data } = await apiClient.put<OrgPolicy>(
    '/organizations/me/notification-policy/',
    payload
  );
  return data;
}
```

In `src/api/endpoints/account.ts`, delete `listNotifications` and `markNotification` and their now-unused type imports (`NotificationMarkReadRequest`, `NotificationRead`). Confirm no callers: `grep -rn "listNotifications\|markNotification(" src App.js` should only show the new module. If `src/api/endpoints/index.ts` re-exports endpoint modules, add `export * as notifications from './notifications';` in its existing style.

- [ ] **Step 6: Run tests and type-check**

Run: `npm test -- src/api && npx tsc --noEmit -p .`
Expected: PASS; no new type errors. Before Task 1, record the baseline with `npx tsc --noEmit -p . 2>&1 | grep -c "error TS" > /tmp/tsc-baseline.txt`; the count must not grow.

- [ ] **Step 7: Commit**

```bash
git add docs/api/openapi.json src/api
git commit -m "feat(api): notification feed, counts, preferences and policy endpoints"
```

---

### Task 3: Push registration

**Files:**
- Create: `src/notifications/pushRegistration.ts`
- Create: `src/notifications/usePushRegistration.ts`
- Modify: `src/auth/AuthContext.tsx` (`logout`)
- Test: `src/notifications/__tests__/pushRegistration.test.ts`, `src/auth/__tests__/AuthContext.logoutPush.test.tsx`

**Interfaces:**
- Consumes: `registerForPush()` from `src/services/NotificationService.ts` (returns `{ token: string | null; platform: 'ios' | 'android' | 'web'; status }`), `registerPushToken` / `unregisterPushToken` from `src/api/endpoints/account.ts`.
- Produces:
  - `syncPushRegistration(ctx: { userId: number; orgId: number }) => Promise<'registered' | 'unchanged' | 'skipped'>`
  - `unregisterPush() => Promise<void>` (never throws)
  - `usePushRegistration(): void` — call once inside a component under `AuthProvider`

- [ ] **Step 1: Write the failing tests**

`src/notifications/__tests__/pushRegistration.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NotificationService from '../../services/NotificationService';
import * as account from '../../api/endpoints/account';
import { syncPushRegistration, unregisterPush } from '../pushRegistration';

jest.mock('../../services/NotificationService', () => ({ registerForPush: jest.fn() }));
jest.mock('../../api/endpoints/account', () => ({
  registerPushToken: jest.fn(async () => ({})),
  unregisterPushToken: jest.fn(async () => undefined),
}));

const store: Record<string, string> = {};
beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(store)) delete store[k];
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => store[k] ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => { store[k] = v; });
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (k: string) => { delete store[k]; });
});

const granted = { token: 'ExponentPushToken[a]', platform: 'ios', status: 'granted' };

describe('syncPushRegistration', () => {
  it('registers the token with platform and device id', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('registered');
    expect(account.registerPushToken).toHaveBeenCalledWith({
      token: 'ExponentPushToken[a]', platform: 'ios', device_id: expect.any(String),
    });
  });

  it('does not re-post an unchanged token for the same user and org', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await syncPushRegistration({ userId: 1, orgId: 2 });
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('unchanged');
    expect(account.registerPushToken).toHaveBeenCalledTimes(1);
  });

  it('re-posts after an org switch', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await syncPushRegistration({ userId: 1, orgId: 2 });
    await syncPushRegistration({ userId: 1, orgId: 3 });
    expect(account.registerPushToken).toHaveBeenCalledTimes(2);
  });

  it('skips when permission denied', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue({ token: null, platform: 'ios', status: 'denied' });
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('skipped');
    expect(account.registerPushToken).not.toHaveBeenCalled();
  });

  it('skips when no token (simulator/web)', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue({ token: null, platform: 'web', status: 'granted' });
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('skipped');
  });

  it('skips and does not cache when the POST fails', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    (account.registerPushToken as jest.Mock).mockRejectedValueOnce(new Error('network'));
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('skipped');
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('registered');
  });
});

describe('unregisterPush', () => {
  it('deletes the cached token and clears the cache', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await syncPushRegistration({ userId: 1, orgId: 2 });
    await unregisterPush();
    expect(account.unregisterPushToken).toHaveBeenCalledWith({ token: 'ExponentPushToken[a]' });
    expect(store['notifications.pushRegistration.v1']).toBeUndefined();
  });

  it('never throws', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await syncPushRegistration({ userId: 1, orgId: 2 });
    (account.unregisterPushToken as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(unregisterPush()).resolves.toBeUndefined();
  });

  it('does nothing when nothing was registered', async () => {
    await unregisterPush();
    expect(account.unregisterPushToken).not.toHaveBeenCalled();
  });
});
```

`src/auth/__tests__/AuthContext.logoutPush.test.tsx` — model it on `src/auth/__tests__/AuthContext.bootstrap.test.tsx` (read that file first and reuse its provider render helper and mocks for `../../api/endpoints/auth`, `tokenStore`, `userCache`, `queryClient`). The two cases:

```tsx
// add to the mocks copied from AuthContext.bootstrap.test.tsx:
const mockUnregister = jest.fn(async () => undefined);
jest.mock('../../notifications/pushRegistration', () => ({
  unregisterPush: () => mockUnregister(),
}));

it('unregister before logout', async () => {
  const calls: string[] = [];
  mockUnregister.mockImplementation(async () => { calls.push('unregister'); });
  (auth.logout as jest.Mock).mockImplementation(async () => { calls.push('logout'); });
  const ctx = await renderSignedIn(); // helper from the bootstrap test
  await act(() => ctx.logout());
  expect(calls).toEqual(['unregister', 'logout']);
});

it('logout still succeeds when unregister fails', async () => {
  mockUnregister.mockRejectedValue(new Error('offline'));
  const ctx = await renderSignedIn();
  await act(() => ctx.logout());
  expect(auth.logout).toHaveBeenCalled();
});
```

If the bootstrap test has no signed-in helper, write `renderSignedIn()` in this file: mock `tokenStore.hydrate` to return tokens and `account.getMeBootstrap` to resolve a `UserMe`, render `<AuthProvider>` with a consumer that captures `useAuth()`, and `await waitFor(() => expect(captured.status).toBe('authenticated'))`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/notifications/__tests__/pushRegistration.test.ts src/auth/__tests__/AuthContext.logoutPush.test.tsx`
Expected: FAIL — module not found / call order `['logout']`.

- [ ] **Step 3: Implement `pushRegistration.ts`**

```ts
// Registers this device's Expo push token with the backend and removes it on
// logout. Registration is best-effort: permission denied, simulators and
// network failures all resolve quietly so sign-in is never blocked.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { registerForPush } from '../services/NotificationService';
import { registerPushToken, unregisterPushToken } from '../api/endpoints/account';

const KEY = 'notifications.pushRegistration.v1';

interface Stored {
  token: string;
  userId: number;
  orgId: number;
}

async function readStored(): Promise<Stored | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

async function deviceId(): Promise<string> {
  try {
    if (Platform.OS === 'android') return Application.getAndroidId() ?? '';
    if (Platform.OS === 'ios') return (await Application.getIosIdForVendorAsync()) ?? '';
  } catch {
    // fall through
  }
  return '';
}

export async function syncPushRegistration(ctx: {
  userId: number;
  orgId: number;
}): Promise<'registered' | 'unchanged' | 'skipped'> {
  const result = await registerForPush();
  if (result.status !== 'granted' || !result.token || result.platform === 'web') {
    return 'skipped';
  }
  const stored = await readStored();
  if (
    stored &&
    stored.token === result.token &&
    stored.userId === ctx.userId &&
    stored.orgId === ctx.orgId
  ) {
    return 'unchanged';
  }
  try {
    await registerPushToken({
      token: result.token,
      platform: result.platform,
      device_id: await deviceId(),
    });
  } catch {
    return 'skipped';
  }
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ token: result.token, userId: ctx.userId, orgId: ctx.orgId })
  );
  return 'registered';
}

export async function unregisterPush(): Promise<void> {
  const stored = await readStored();
  if (!stored) return;
  try {
    await unregisterPushToken({ token: stored.token });
  } catch {
    // Offline or already gone: the backend prunes dead tokens from Expo receipts.
  }
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
```

Check `PushTokenRequest.platform`'s generated type accepts `'ios' | 'android'`; `result.platform` is narrowed by the `!== 'web'` check above.

- [ ] **Step 4: Implement `usePushRegistration.ts`**

```ts
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
```

- [ ] **Step 5: Unregister before logout in `AuthContext.tsx`**

Add `import { unregisterPush } from '../notifications/pushRegistration';` and change `logout`:

```ts
  const logout = useCallback(async () => {
    // Remove this device's push token while the session is still valid, so a
    // shared phone stops receiving the previous user's notifications.
    try {
      await unregisterPush();
    } catch {
      // unregisterPush never throws; belt and braces for the logout path.
    }
    await auth.logout();
    await clearQueryCache();
    await clearCachedUser();
    applyUser(null);
  }, [applyUser]);
```

- [ ] **Step 6: Run tests**

Run: `npm test -- src/notifications src/auth`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/notifications src/auth
git commit -m "feat(notifications): register push token after login, remove it before logout"
```

---

### Task 4: Navigation ref and link routing

**Files:**
- Create: `src/navigation/navigationRef.ts`
- Create: `src/notifications/linkRouting.ts`
- Modify: `src/navigation/index.tsx` (pass `ref={navigationRef}` to `NavigationContainer`)
- Test: `src/notifications/__tests__/linkRouting.test.ts`

**Interfaces:**
- Produces:
  - `navigationRef` (`createNavigationContainerRef<any>()`)
  - `type NotificationLinkLike = { kind: string; id: number } | null | undefined`
  - `routeForLink(link: NotificationLinkLike, opts: { isAdminOrOwner: boolean }) => { name: string; params?: Record<string, unknown> }`
  - `navigateToLink(link, opts) => boolean` — navigates via `navigationRef` if ready, returns whether it navigated

- [ ] **Step 1: Write the failing test**

```ts
import { routeForLink } from '../linkRouting';

describe('routeForLink', () => {
  const officer = { isAdminOrOwner: true };
  const worker = { isAdminOrOwner: false };

  it('tool → DeviceDetails with deviceId', () => {
    expect(routeForLink({ kind: 'tool', id: 42 }, worker)).toEqual({
      name: 'DeviceDetails', params: { deviceId: 42 },
    });
  });

  it('join_request → Members for officers', () => {
    expect(routeForLink({ kind: 'join_request', id: 3 }, officer)).toEqual({ name: 'Members' });
  });

  it('join_request → inbox for everyone else (e.g. an approved requester)', () => {
    expect(routeForLink({ kind: 'join_request', id: 3 }, worker)).toEqual({ name: 'Notifications' });
  });

  it('unknown kind → inbox', () => {
    expect(routeForLink({ kind: 'transfer', id: 1 }, officer)).toEqual({ name: 'Notifications' });
  });

  it('null link → inbox', () => {
    expect(routeForLink(null, officer)).toEqual({ name: 'Notifications' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/notifications/__tests__/linkRouting.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/navigation/navigationRef.ts`:

```ts
import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside the React tree (notification taps) navigate.
export const navigationRef = createNavigationContainerRef<any>();
```

`src/notifications/linkRouting.ts`:

```ts
import { navigationRef } from '../navigation/navigationRef';

export type NotificationLinkLike = { kind: string; id: number } | null | undefined;

export interface Route {
  name: string;
  params?: Record<string, unknown>;
}

const INBOX: Route = { name: 'Notifications' };

export function routeForLink(link: NotificationLinkLike, opts: { isAdminOrOwner: boolean }): Route {
  if (!link) return INBOX;
  if (link.kind === 'tool' && link.id) {
    // DeviceDetailsScreen reads route.params.deviceId.
    return { name: 'DeviceDetails', params: { deviceId: link.id } };
  }
  if (link.kind === 'join_request' && opts.isAdminOrOwner) {
    return { name: 'Members' };
  }
  return INBOX;
}

export function navigateToLink(link: NotificationLinkLike, opts: { isAdminOrOwner: boolean }): boolean {
  if (!navigationRef.isReady()) return false;
  const route = routeForLink(link, opts);
  navigationRef.navigate(route.name as never, route.params as never);
  return true;
}
```

In `src/navigation/index.tsx`: `import { navigationRef } from './navigationRef';` and change `<NavigationContainer linking={linking}>` to `<NavigationContainer ref={navigationRef} linking={linking}>`.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/notifications src/navigation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/navigation src/notifications
git commit -m "feat(notifications): navigation ref and notification link routing"
```

---

### Task 5: Query hooks

**Files:**
- Create: `src/notifications/queries.ts`
- Test: `src/notifications/__tests__/queries.test.tsx`

**Interfaces:**
- Consumes: Task 2 endpoint functions.
- Produces:
  - `notificationKeys = { all: ['notifications'], feed: (status) => ['notifications','feed',status], unread: ['notifications','unread-count'], prefs: ['notifications','preferences'], policy: ['notifications','policy'] }`
  - `useNotificationsFeed(status: 'all' | 'unread')` — `useInfiniteQuery`, `getNextPageParam: (last) => last.next_cursor ?? undefined`
  - `useUnreadCount(): { count: number; isLoading: boolean }` — `refetchInterval: 60_000`, `refetchIntervalInBackground: false`
  - `useMarkRead()` — mutation `(id: number) => markNotificationRead(id)`; optimistic `is_read=true` in feed caches; invalidates `notificationKeys.all` on settle
  - `useMarkAllRead()` — mutation; invalidates `notificationKeys.all`
  - `useNotificationPreferences()`, `useUpdateNotificationPreferences()`, `useNotificationPolicy(enabled: boolean)`, `useUpdateNotificationPolicy()`

- [ ] **Step 1: Write the failing tests**

```tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as api from '../../api/endpoints/notifications';
import { useMarkAllRead, useMarkRead, useNotificationsFeed, useUnreadCount } from '../queries';

jest.mock('../../api/endpoints/notifications');

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}

const item = (id: number, is_read = false) => ({
  id, notification_type: 'system', title: `t${id}`, message: 'm', is_read,
  read_at: null, created_at: '2026-09-24T10:00:00Z', link: null,
});

describe('notification queries', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pages the feed with next_cursor', async () => {
    (api.listNotifications as jest.Mock)
      .mockResolvedValueOnce({ items: [item(1)], next_cursor: 'c2', prev_cursor: null })
      .mockResolvedValueOnce({ items: [item(2)], next_cursor: null, prev_cursor: 'c2' });
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useNotificationsFeed('unread'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.listNotifications).toHaveBeenCalledWith({ status: 'unread', cursor: null, limit: 25 });
    await act(() => result.current.fetchNextPage());
    expect(api.listNotifications).toHaveBeenLastCalledWith({ status: 'unread', cursor: 'c2', limit: 25 });
    expect(result.current.hasNextPage).toBe(false);
  });

  it('exposes the unread count', async () => {
    (api.getUnreadCount as jest.Mock).mockResolvedValue(5);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useUnreadCount(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.count).toBe(5));
  });

  it('mark read updates the cached feed optimistically', async () => {
    (api.listNotifications as jest.Mock).mockResolvedValue({ items: [item(1)], next_cursor: null, prev_cursor: null });
    (api.markNotificationRead as jest.Mock).mockResolvedValue(item(1, true));
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () => ({ feed: useNotificationsFeed('all'), mark: useMarkRead() }),
      { wrapper: Wrapper }
    );
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true));
    await act(() => result.current.mark.mutateAsync(1));
    expect(result.current.feed.data?.pages[0].items[0].is_read).toBe(true);
  });

  it('mark all read invalidates notification queries', async () => {
    (api.markAllNotificationsRead as jest.Mock).mockResolvedValue(3);
    const { client, Wrapper } = wrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useMarkAllRead(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync());
    expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/notifications/__tests__/queries.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `queries.ts`**

```ts
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as api from '../api/endpoints/notifications';
import type { OrgPolicyUpdate, PagedNotifications, UserPreferences } from '../api/types';

type Status = 'all' | 'unread';
const PAGE_SIZE = 25;

export const notificationKeys = {
  all: ['notifications'] as const,
  feed: (status: Status) => ['notifications', 'feed', status] as const,
  unread: ['notifications', 'unread-count'] as const,
  prefs: ['notifications', 'preferences'] as const,
  policy: ['notifications', 'policy'] as const,
};

export function useNotificationsFeed(status: Status) {
  return useInfiniteQuery({
    queryKey: notificationKeys.feed(status),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.listNotifications({ status, cursor: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (last: PagedNotifications) => last.next_cursor ?? undefined,
  });
}

export function useUnreadCount() {
  const q = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: api.getUnreadCount,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });
  return { count: q.data ?? 0, isLoading: q.isLoading };
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      qc.setQueriesData<InfiniteData<PagedNotifications>>(
        { queryKey: ['notifications', 'feed'] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              items: p.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
            })),
          }
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useNotificationPreferences() {
  return useQuery({ queryKey: notificationKeys.prefs, queryFn: api.getNotificationPreferences });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserPreferences) => api.updateNotificationPreferences(payload),
    onSuccess: (data) => qc.setQueryData(notificationKeys.prefs, data),
  });
}

export function useNotificationPolicy(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.policy,
    queryFn: api.getNotificationPolicy,
    enabled,
  });
}

export function useUpdateNotificationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrgPolicyUpdate) => api.updateNotificationPolicy(payload),
    onSuccess: (data) => {
      qc.setQueryData(notificationKeys.policy, data);
      // Policy changes alter what the user's own preferences screen shows.
      qc.invalidateQueries({ queryKey: notificationKeys.prefs });
    },
  });
}
```

The test's `mark read` case relies on `onMutate` running before the refetch in `onSettled`; the mocked `listNotifications` returns the unread item again on refetch, so assert immediately after `mutateAsync` resolves (as written). If the refetch lands first and flakes, change the refetch mock to `mockResolvedValueOnce(...unread).mockResolvedValue({ items: [item(1, true)], … })`.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/notifications`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notifications/queries.ts src/notifications/__tests__/queries.test.tsx
git commit -m "feat(notifications): query hooks for feed, unread count, read state and settings"
```

---

### Task 6: NotificationsBridge — handlers, listeners, tap routing

**Files:**
- Create: `src/notifications/NotificationsBridge.tsx`
- Modify: `src/navigation/index.tsx` (render the bridge for signed-in users)
- Test: `src/notifications/__tests__/NotificationsBridge.test.tsx`

**Interfaces:**
- Consumes: `configureForegroundHandler`, `addNotificationReceivedListener`, `addNotificationResponseListener` (`NotificationService.ts`); `navigateToLink`, `navigationRef` (Task 4); `markNotificationRead` (Task 2); `notificationKeys` (Task 5); `usePushRegistration` (Task 3); `useAuth`.
- Produces: `<NotificationsBridge />` (renders `null`). Push payload contract from the backend: `data = { notification_id: number, type: string, link: { kind, id } | null }`.

- [ ] **Step 1: Write the failing tests**

```tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import * as api from '../../api/endpoints/notifications';
import { navigationRef } from '../../navigation/navigationRef';
import NotificationsBridge from '../NotificationsBridge';

jest.mock('../../api/endpoints/notifications', () => ({ markNotificationRead: jest.fn(async () => ({})) }));
jest.mock('../usePushRegistration', () => ({ usePushRegistration: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ isAdminOrOwner: false }) }));
jest.mock('../../navigation/navigationRef', () => {
  const ref: any = { isReady: jest.fn(() => true), navigate: jest.fn(), addListener: jest.fn(() => jest.fn()) };
  return { navigationRef: ref };
});

const response = (data: any) => ({ notification: { request: { content: { data } } } });

function renderBridge() {
  const client = new QueryClient();
  const spy = jest.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><NotificationsBridge /></QueryClientProvider>);
  return spy;
}

describe('NotificationsBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
  });

  it('installs the foreground handler', () => {
    renderBridge();
    expect(Notifications.setNotificationHandler).toHaveBeenCalled();
  });

  it('refreshes notification queries when a push arrives', () => {
    const spy = renderBridge();
    const onReceive = (Notifications.addNotificationReceivedListener as jest.Mock).mock.calls[0][0];
    onReceive({});
    expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('tap marks read and opens the tool', async () => {
    renderBridge();
    const onTap = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
    onTap(response({ notification_id: 9, link: { kind: 'tool', id: 4 } }));
    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalledWith(9));
    expect(navigationRef.navigate).toHaveBeenCalledWith('DeviceDetails', { deviceId: 4 });
  });

  it('tap with no link opens inbox', () => {
    renderBridge();
    const onTap = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
    onTap(response({ notification_id: 9, link: null }));
    expect(navigationRef.navigate).toHaveBeenCalledWith('Notifications', undefined);
  });

  it('cold start replays once when ready', async () => {
    (navigationRef.isReady as jest.Mock).mockReturnValue(false);
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      response({ notification_id: 1, link: { kind: 'tool', id: 2 } })
    );
    renderBridge();
    await waitFor(() => expect(navigationRef.addListener).toHaveBeenCalledWith('state', expect.any(Function)));
    const onState = (navigationRef.addListener as jest.Mock).mock.calls[0][1];
    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
    onState();
    onState();
    expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/notifications/__tests__/NotificationsBridge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `NotificationsBridge.tsx`**

```tsx
// Installs Expo notification handlers for a signed-in session and routes taps.
// Renders nothing. Mounted by AppNavigator only when authenticated.
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  configureForegroundHandler,
} from '../services/NotificationService';
import { markNotificationRead } from '../api/endpoints/notifications';
import { useAuth } from '../auth/AuthContext';
import { navigationRef } from '../navigation/navigationRef';
import { navigateToLink, type NotificationLinkLike } from './linkRouting';
import { notificationKeys } from './queries';
import { usePushRegistration } from './usePushRegistration';

interface PushData {
  notification_id?: number;
  link?: NotificationLinkLike;
}

function dataOf(response: Notifications.NotificationResponse | null): PushData | null {
  const data = response?.notification?.request?.content?.data as PushData | undefined;
  return data ?? null;
}

export default function NotificationsBridge(): null {
  const qc = useQueryClient();
  const { isAdminOrOwner } = useAuth();
  const opts = useRef({ isAdminOrOwner });
  opts.current = { isAdminOrOwner };
  usePushRegistration();

  useEffect(() => {
    configureForegroundHandler();

    const handleTap = (data: PushData | null) => {
      if (!data) return;
      if (data.notification_id) {
        void markNotificationRead(data.notification_id)
          .catch(() => undefined)
          .finally(() => qc.invalidateQueries({ queryKey: notificationKeys.all }));
      }
      navigateToLink(data.link, opts.current);
    };

    const offReceive = addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    });
    const offTap = addNotificationResponseListener((r) => handleTap(dataOf(r)));

    // Cold start: the app was launched by tapping a notification.
    let offState: (() => void) | undefined;
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      const data = dataOf(r);
      if (cancelled || !data) return;
      if (navigationRef.isReady()) {
        handleTap(data);
        return;
      }
      let done = false;
      offState = navigationRef.addListener('state', () => {
        if (done || !navigationRef.isReady()) return;
        done = true;
        handleTap(data);
        offState?.();
      });
    });

    return () => {
      cancelled = true;
      offReceive();
      offTap();
      offState?.();
    };
  }, [qc]);

  return null;
}
```

Note: `getLastNotificationResponseAsync` also returns the last *warm* tap, which the response listener already handled. That is harmless — a second navigate to the same route is a no-op in the stack — but if it double-marks read in practice, store the last handled `notification_id` in a module-level variable and skip repeats.

- [ ] **Step 4: Mount it** in `src/navigation/index.tsx`, inside `NavigationContainer`:

```tsx
import NotificationsBridge from '../notifications/NotificationsBridge';
...
    <NavigationContainer ref={navigationRef} linking={linking}>
      {isAuthenticated ? (
        <WhatsNewProvider>
          <NotificationsBridge />
          <OnboardingStack />
        </WhatsNewProvider>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/notifications src/navigation`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/notifications src/navigation/index.tsx
git commit -m "feat(notifications): foreground handler, live refresh and tap-to-open routing"
```

---

### Task 7: Inbox screen, bell and badge wiring

**Files:**
- Create: `src/screens/Notifications/NotificationsScreen.tsx`
- Modify: `src/navigation/index.tsx` (register `Notifications`)
- Modify: `src/screens/Dashboard/ControlRoom/ControlRoomScreen.tsx:46-48,91-97`, `src/screens/Dashboard/FleetStatus/FleetStatusScreen.tsx:90-96`, `src/screens/Dashboard/DashboardScreen.tsx` (`StandardDashboard`), `src/screens/Dashboard/quickActions.ts:30`
- Modify: `src/screens/Dashboard/ControlRoom/hooks/useControlRoomData.ts:132,196`, `src/screens/Dashboard/FleetStatus/hooks/useFleetStatusData.ts:144` (remove `hasUnreadAlerts`), their `types.ts`
- Test: `src/screens/Notifications/__tests__/NotificationsScreen.test.tsx`, update `src/screens/Dashboard/__tests__/DashboardScreen.test.tsx`

**Interfaces:**
- Consumes: `useNotificationsFeed`, `useMarkRead`, `useMarkAllRead`, `useUnreadCount` (Task 5); `routeForLink` (Task 4).
- Produces: route `Notifications`; `DashboardHeader` gets `hasUnreadAlerts={count > 0}` from `useUnreadCount()` on all three dashboards.

- [ ] **Step 1: Write the failing screen test**

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NotificationsScreen from '../NotificationsScreen';
import * as q from '../../../notifications/queries';

jest.mock('../../../notifications/queries');
jest.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ isAdminOrOwner: false }) }));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: { background: '#fff', card: '#fff', textPrimary: '#000', textSecondary: '#666', primary: '#FFC72C', border: '#eee' } }),
}));
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
}));

const item = (id: number, extra: any = {}) => ({
  id, notification_type: 'transfer_requested', title: `Title ${id}`, message: 'Body',
  is_read: false, read_at: null, created_at: '2026-09-24T10:00:00Z', link: null, ...extra,
});

const markRead = jest.fn();
const markAll = jest.fn();

function feed(items: any[], extra: any = {}) {
  (q.useNotificationsFeed as jest.Mock).mockReturnValue({
    data: { pages: [{ items, next_cursor: null }] },
    isLoading: false, isError: false, isRefetching: false,
    hasNextPage: false, fetchNextPage: jest.fn(), refetch: jest.fn(), ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (q.useMarkRead as jest.Mock).mockReturnValue({ mutate: markRead });
  (q.useMarkAllRead as jest.Mock).mockReturnValue({ mutate: markAll, isPending: false });
});

it('renders rows and switches to the Unread tab', () => {
  feed([item(1)]);
  render(<NotificationsScreen />);
  expect(screen.getByText('Title 1')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Show unread'));
  expect(q.useNotificationsFeed).toHaveBeenLastCalledWith('unread');
});

it('tapping a row marks it read and follows its link', () => {
  feed([item(1, { link: { kind: 'tool', id: 7 } })]);
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByText('Title 1'));
  expect(markRead).toHaveBeenCalledWith(1);
  expect(mockNavigate).toHaveBeenCalledWith('DeviceDetails', { deviceId: 7 });
});

it('a row with no link only marks read', () => {
  feed([item(1)]);
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByText('Title 1'));
  expect(markRead).toHaveBeenCalledWith(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('mark all read', () => {
  feed([item(1)]);
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByLabelText('Mark all read'));
  expect(markAll).toHaveBeenCalled();
});

it('empty and error states', () => {
  feed([]);
  const { rerender } = render(<NotificationsScreen />);
  expect(screen.getByText("You're all caught up")).toBeTruthy();
  feed([], { isError: true });
  rerender(<NotificationsScreen />);
  expect(screen.getByText("Couldn't load notifications")).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/screens/Notifications`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `NotificationsScreen.tsx`**

```tsx
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import { useMarkAllRead, useMarkRead, useNotificationsFeed } from '../../notifications/queries';
import { routeForLink } from '../../notifications/linkRouting';
import type { NotificationRead } from '../../api/types';

type Tab = 'all' | 'unread';

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const NotificationsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { isAdminOrOwner } = useAuth();
  const [tab, setTab] = useState<Tab>('all');
  const feed = useNotificationsFeed(tab);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  useLayoutEffect(() => {
    navigation.setOptions?.({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationSettings')}
          accessibilityLabel="Notification settings"
          style={{ paddingHorizontal: 16 }}
        >
          <Ionicons name="settings-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.primary]);

  const items = useMemo(
    () => feed.data?.pages.flatMap((p) => p.items) ?? [],
    [feed.data]
  );

  const onPressItem = useCallback(
    (n: NotificationRead) => {
      if (!n.is_read) markRead.mutate(n.id);
      if (n.link) {
        const route = routeForLink(n.link, { isAdminOrOwner });
        if (route.name !== 'Notifications') navigation.navigate(route.name, route.params);
      }
    },
    [markRead, navigation, isAdminOrOwner]
  );

  const renderItem = ({ item }: { item: NotificationRead }) => (
    <TouchableOpacity
      onPress={() => onPressItem(item)}
      style={[styles.row, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
      accessibilityRole="button"
    >
      <View style={[styles.dot, { backgroundColor: item.is_read ? 'transparent' : colors.primary }]} />
      <View style={styles.rowText}>
        <Text style={[styles.title, { color: colors.textPrimary }, !item.is_read && styles.unread]}>
          {item.title}
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.message}
        </Text>
      </View>
      <Text style={[styles.time, { color: colors.textSecondary }]}>{timeAgo(item.created_at)}</Text>
    </TouchableOpacity>
  );

  let body: React.ReactNode;
  if (feed.isLoading) {
    body = <ActivityIndicator style={styles.center} color={colors.primary} />;
  } else if (feed.isError) {
    body = (
      <View style={styles.center}>
        <Text style={{ color: colors.textPrimary }}>Couldn't load notifications</Text>
        <TouchableOpacity onPress={() => feed.refetch()} accessibilityLabel="Retry">
          <Text style={{ color: colors.primary, marginTop: 8 }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (items.length === 0) {
    body = (
      <View style={styles.center}>
        <Ionicons name="notifications-off-outline" size={32} color={colors.textSecondary} />
        <Text style={{ color: colors.textPrimary, marginTop: 8 }}>You're all caught up</Text>
      </View>
    );
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        renderItem={renderItem}
        onEndReachedThreshold={0.5}
        onEndReached={() => feed.hasNextPage && feed.fetchNextPage()}
        refreshControl={
          <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} />
        }
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        {(['all', 'unread'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            accessibilityLabel={t === 'all' ? 'Show all' : 'Show unread'}
            style={[styles.tab, tab === t && { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: tab === t ? '#111' : colors.textSecondary }}>
              {t === 'all' ? 'All' : 'Unread'}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => markAll.mutate()}
          disabled={markAll.isPending}
          accessibilityLabel="Mark all read"
        >
          <Text style={{ color: colors.primary }}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      {body}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 10 },
  rowText: { flex: 1 },
  title: { fontSize: 15 },
  unread: { fontWeight: '700' },
  message: { fontSize: 13, marginTop: 2 },
  time: { fontSize: 12, marginLeft: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

export default NotificationsScreen;
```

- [ ] **Step 4: Register the route** in `MainStack` (`src/navigation/index.tsx`), next to `NotificationPreferences`:

```tsx
    <Stack.Screen
      name="Notifications"
      component={NotificationsScreen}
      options={{
        headerShown: true,
        headerTitle: 'Notifications',
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
```

with `import NotificationsScreen from '../screens/Notifications/NotificationsScreen';`.

- [ ] **Step 5: Wire the bell**

- `ControlRoomScreen.tsx`: `import { useUnreadCount } from '../../../notifications/queries';`, `const { count: unread } = useUnreadCount();`, pass `hasUnreadAlerts={unread > 0}` and `onAlertsPress={() => navigation.navigate('Notifications')}`; change the `alerts` quick action's `onPress` to `navigation.navigate('Notifications')`.
- `FleetStatusScreen.tsx`: same two changes on its `DashboardHeader`.
- `useControlRoomData.ts` / `useFleetStatusData.ts` and their `types.ts`: delete the `hasUnreadAlerts` field and the `BACKEND_GAP` comment about the bell.
- `quickActions.ts`: change the `notifications` tile's `destination` to `'Notifications'` and its comment to "Notification inbox".
- `DashboardScreen.tsx` `StandardDashboard`: add a bell row above "Quick Actions":

```tsx
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity } from 'react-native';
import { useUnreadCount } from '../../notifications/queries';
...
  const { count: unread } = useUnreadCount();
...
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="View alerts"
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
          {unread > 0 ? <View style={[styles.bellDot, { backgroundColor: colors.primary }]} /> : null}
        </TouchableOpacity>
      </View>
```

(replacing the existing "Quick Actions" `Text`), with styles `headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }`, `bell: { padding: 6 }`, `bellDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4 }`.

- `DashboardScreen.test.tsx`: add `jest.mock('../../../notifications/queries', () => ({ useUnreadCount: () => ({ count: 2 }) }));` and a test:

```tsx
  it('shows the bell for workers and opens the inbox', () => {
    currentRole = 'site_worker';
    render(<DashboardScreen />);
    fireEvent.press(screen.getByLabelText('View alerts'));
    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });
```

(import `fireEvent`). Owner/admin dashboards render `ControlRoomScreen`/`FleetStatusScreen`, which now call `useUnreadCount` — the same mock covers them.

- [ ] **Step 6: Run tests and type-check**

Run: `npm test -- src/screens/Notifications src/screens/Dashboard && npx tsc --noEmit -p .`
Expected: PASS; no new type errors.

- [ ] **Step 7: Commit**

```bash
git add src/screens src/navigation/index.tsx
git commit -m "feat(notifications): inbox screen, live bell badge on every dashboard"
```

---

### Task 8: Notification settings screen

**Files:**
- Create: `src/screens/Notifications/NotificationSettingsScreen.tsx`
- Modify: `src/navigation/index.tsx` (register `NotificationSettings`)
- Modify: `src/screens/Settings/sections.ts:45` (row destination), `src/screens/ProfileScreen.js:93-103,271-290`
- Test: `src/screens/Notifications/__tests__/NotificationSettingsScreen.test.tsx`, update `src/screens/Settings/__tests__/sections.test.ts` if it asserts the destination

**Interfaces:**
- Consumes: `useNotificationPreferences`, `useUpdateNotificationPreferences`, `useNotificationPolicy`, `useUpdateNotificationPolicy` (Task 5); `useAuth().isAdminOrOwner`.
- Produces: route `NotificationSettings`.

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NotificationSettingsScreen from '../NotificationSettingsScreen';
import * as q from '../../../notifications/queries';

jest.mock('../../../notifications/queries');
let mockOfficer = false;
jest.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ isAdminOrOwner: mockOfficer }) }));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: { background: '#fff', card: '#fff', textPrimary: '#000', textSecondary: '#666', primary: '#FFC72C', border: '#eee', disabled: '#ccc' } }),
}));

const prefs = {
  master: { push: true, email: true },
  types: [
    { type: 'transfer_requested', label: 'Transfer Requested', description: '', urgent: false, locked: false,
      push: { enabled: true, editable: true }, email: { enabled: true, editable: false } },
    { type: 'maintenance_due', label: 'Maintenance Due', description: '', urgent: false, locked: true,
      push: { enabled: true, editable: false }, email: { enabled: true, editable: false } },
    { type: 'transfer_accepted', label: 'Transfer Accepted', description: '', urgent: false, locked: false,
      push: { enabled: true, editable: false }, email: { enabled: false, editable: false } },
  ],
};
const savePrefs = jest.fn();
const savePolicy = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockOfficer = false;
  (q.useNotificationPreferences as jest.Mock).mockReturnValue({ data: prefs, isLoading: false, isError: false });
  (q.useUpdateNotificationPreferences as jest.Mock).mockReturnValue({ mutate: savePrefs, isPending: false });
  (q.useNotificationPolicy as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
  (q.useUpdateNotificationPolicy as jest.Mock).mockReturnValue({ mutate: savePolicy, isPending: false });
});

it('toggling an editable switch saves the whole payload', () => {
  render(<NotificationSettingsScreen />);
  fireEvent(screen.getByLabelText('Transfer Requested push'), 'valueChange', false);
  expect(savePrefs).toHaveBeenCalledWith(expect.objectContaining({
    types: expect.arrayContaining([
      expect.objectContaining({ type: 'transfer_requested', push: { enabled: false, editable: true } }),
    ]),
  }));
});

it('disabled rows cannot be toggled and explain why', () => {
  render(<NotificationSettingsScreen />);
  expect(screen.getByLabelText('Transfer Requested email').props.disabled).toBe(true);
  expect(screen.getByText('Required')).toBeTruthy();
  expect(screen.getByText('Managed by your organisation')).toBeTruthy();
});

it('workers do not see organisation defaults', () => {
  render(<NotificationSettingsScreen />);
  expect(screen.queryByText('Organisation defaults')).toBeNull();
  expect(q.useNotificationPolicy).toHaveBeenCalledWith(false);
});

it('officers can change the digest interval', () => {
  mockOfficer = true;
  (q.useNotificationPolicy as jest.Mock).mockReturnValue({
    data: { digest_minutes: 60, members_can_disable_push: true, members_can_disable_email: true, types: [] },
    isLoading: false,
  });
  render(<NotificationSettingsScreen />);
  fireEvent.press(screen.getByLabelText('Digest every 30 minutes'));
  expect(savePolicy).toHaveBeenCalledWith(expect.objectContaining({ digest_minutes: 30 }));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/screens/Notifications/__tests__/NotificationSettingsScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `NotificationSettingsScreen.tsx`**

```tsx
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import {
  useNotificationPolicy, useNotificationPreferences,
  useUpdateNotificationPolicy, useUpdateNotificationPreferences,
} from '../../notifications/queries';
import type { OrgPolicy, TypePolicy, TypePreference, UserPreferences } from '../../api/types';

type Channel = 'push' | 'email';

const NotificationSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { isAdminOrOwner } = useAuth();
  const prefsQ = useNotificationPreferences();
  const savePrefs = useUpdateNotificationPreferences();
  const policyQ = useNotificationPolicy(isAdminOrOwner);
  const savePolicy = useUpdateNotificationPolicy();

  if (prefsQ.isLoading) {
    return <ActivityIndicator style={styles.center} color={colors.primary} />;
  }
  if (prefsQ.isError || !prefsQ.data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textPrimary }}>Couldn't load notification settings</Text>
      </View>
    );
  }
  const prefs: UserPreferences = prefsQ.data;

  const setMaster = (channel: Channel, value: boolean) =>
    savePrefs.mutate({ ...prefs, master: { ...prefs.master, [channel]: value } });

  const setType = (row: TypePreference, channel: Channel, value: boolean) =>
    savePrefs.mutate({
      ...prefs,
      types: prefs.types.map((r) =>
        r.type === row.type ? { ...r, [channel]: { ...r[channel], enabled: value } } : r
      ),
    });

  const reason = (row: TypePreference) =>
    row.locked ? 'Required' : !row.push.editable && !row.email.editable ? 'Managed by your organisation' : null;

  const policy: OrgPolicy | undefined = policyQ.data;
  const setPolicy = (patch: Partial<OrgPolicy>) => policy && savePolicy.mutate({ ...policy, ...patch });
  const setPolicyType = (row: TypePolicy, patch: Partial<TypePolicy>) =>
    policy && savePolicy.mutate({
      ...policy,
      types: policy.types.map((r) => (r.type === row.type ? { ...r, ...patch } : r)),
    });

  const sw = (label: string, value: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <Switch
      accessibilityLabel={label}
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: colors.disabled, true: colors.primary }}
    />
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.h, { color: colors.textPrimary }]}>All notifications</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Push notifications</Text>
          {sw('All push notifications', prefs.master.push, (v) => setMaster('push', v))}
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Email notifications</Text>
          {sw('All email notifications', prefs.master.email, (v) => setMaster('email', v))}
        </View>
      </View>

      <Text style={[styles.h, { color: colors.textPrimary }]}>By type</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }} />
          <Text style={[styles.col, { color: colors.textSecondary }]}>Push</Text>
          <Text style={[styles.col, { color: colors.textSecondary }]}>Email</Text>
        </View>
        {prefs.types.map((row) => (
          <View key={row.type} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>{row.label}</Text>
              {reason(row) ? (
                <Text style={[styles.note, { color: colors.textSecondary }]}>{reason(row)}</Text>
              ) : null}
            </View>
            {sw(`${row.label} push`, row.push.enabled, (v) => setType(row, 'push', v), !row.push.editable)}
            {sw(`${row.label} email`, row.email.enabled, (v) => setType(row, 'email', v), !row.email.editable)}
          </View>
        ))}
      </View>

      {isAdminOrOwner && policy ? (
        <>
          <Text style={[styles.h, { color: colors.textPrimary }]}>Organisation defaults</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Email digest</Text>
              {[30, 60].map((m) => (
                <TouchableOpacity
                  key={m}
                  accessibilityLabel={m === 30 ? 'Digest every 30 minutes' : 'Digest every hour'}
                  onPress={() => setPolicy({ digest_minutes: m })}
                  style={[styles.chip, policy.digest_minutes === m && { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: policy.digest_minutes === m ? '#111' : colors.textSecondary }}>
                    {m === 30 ? '30 min' : '1 hour'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Members can turn off push</Text>
              {sw('Members can turn off push', policy.members_can_disable_push, (v) => setPolicy({ members_can_disable_push: v }))}
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Members can turn off email</Text>
              {sw('Members can turn off email', policy.members_can_disable_email, (v) => setPolicy({ members_can_disable_email: v }))}
            </View>
            {policy.types.map((row) => (
              <View key={row.type} style={styles.policyRow}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>{row.label}</Text>
                <View style={styles.policySwitches}>
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Push</Text>
                  {sw(`${row.label} default push`, row.push_enabled, (v) => setPolicyType(row, { push_enabled: v }))}
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Email</Text>
                  {sw(`${row.label} default email`, row.email_enabled, (v) => setPolicyType(row, { email_enabled: v }))}
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Urgent</Text>
                  {sw(`${row.label} urgent`, row.urgent, (v) => setPolicyType(row, { urgent: v }))}
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Lock</Text>
                  {sw(`${row.label} locked`, row.locked, (v) => setPolicyType(row, { locked: v }))}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  card: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  policyRow: { paddingVertical: 10 },
  policySwitches: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  label: { fontSize: 15 },
  note: { fontSize: 12, marginTop: 2 },
  col: { width: 52, textAlign: 'center', fontSize: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

export default NotificationSettingsScreen;
```

- [ ] **Step 4: Register and link**

- `src/navigation/index.tsx` `MainStack`: register `NotificationSettings` exactly like `Notifications` in Task 7 but `headerTitle: 'Notification settings'` and `component={NotificationSettingsScreen}`.
- `src/screens/Settings/sections.ts:45`: set the `notifications` row's `destination` to `'NotificationSettings'`. If `sections.test.ts` asserts the old destination, update it.
- `src/screens/ProfileScreen.js`: replace the whole "Notification Settings Section" `View` (the one with two `Switch`es) with a single row:

```jsx
        <TouchableOpacity
          style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
          onPress={() => navigation.navigate('NotificationSettings')}
          accessibilityRole="button"
          accessibilityLabel="Notification settings"
        >
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Notification settings</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>
```

and delete `notificationsEnabled` / `emailNotificationsEnabled` state, `handlePushNotificationToggle`, `handleEmailNotificationToggle` and the "no-ops until the new API…" comment. Check `ProfileScreen.js` already has `navigation` and `Ionicons` in scope (it navigates to `EditProfile`); import them if not.

- [ ] **Step 5: Run tests and type-check**

Run: `npm test && npx tsc --noEmit -p .`
Expected: full suite PASS; no new type errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens src/navigation/index.tsx
git commit -m "feat(notifications): notification settings screen with organisation defaults"
```

---

### Task 9: Release notes

**Files:**
- Modify: the What's New content file used by `src/hooks/useWhatsNew.ts` (find it with `grep -rn "1.4.9" src --include=*.ts* | head`)

- [ ] **Step 1:** Add a new release entry in the file's existing format, following the most recent entry (1.4.9), with the next version number. Items: "Notifications: get alerts on your phone for tool transfers, approvals, overdue rentals and more", "A notification inbox behind the bell on every dashboard", "Choose which notifications reach you by push or email in Settings → Notifications".
- [ ] **Step 2:** Bump `expo.version` in `app.json` to the same version (native change ⇒ new store build; `runtimeVersion.policy` is `appVersion`, so this also stops OTA updates for this build from reaching older binaries).
- [ ] **Step 3:** Run `npm test` — PASS. Commit: `git commit -am "chore(release): What's New <version> — notifications"`.

---

### Task 10: Credentials, build and end-to-end check (owner + agent)

This task is a checklist; it has no automated tests. The agent prepares, the owner performs the account steps.

- [ ] **Step 1 (owner): Firebase / FCM.** In the Firebase console, add an Android app with package name from `app.json` `expo.android.package` to a Firebase project, download `google-services.json` into the repo root, and commit it (client identifiers only). Create a service-account key with the "Firebase Cloud Messaging API (V1)" role and upload it with `eas credentials` → Android → production → "Google Service Account Key for FCM V1". Do not commit the service-account key.
- [ ] **Step 2 (owner): APNs.** Run `eas credentials` → iOS → production → "Push Notifications: Manage your Apple Push Notifications Key" and let EAS create or reuse a key.
- [ ] **Step 3 (agent):** `git push -u origin feat/notifications` and open a PR against `feat/perf-optimizations` (or whichever branch the owner releases from) linking the backend PR.
- [ ] **Step 4 (owner):** `eas build --platform all --profile production` (or `preview` for TestFlight/internal testing).
- [ ] **Step 5 (both): End-to-end on testapp.tooltraq.com** with `notification_delivery` switched on there:
  1. Sign in on a real device; accept the permission prompt; confirm a `PushToken` row for the user in Django admin.
  2. Start a tool transfer to that user from another account → push arrives within seconds; tapping opens the tool; the inbox shows it read.
  3. With the app open, trigger another → banner shows, bell dot appears.
  4. Kill the app, trigger another, tap the push → app cold-starts onto the tool.
  5. Turn off push for "Transfer Requested" in Notification settings → the next transfer creates an inbox row but no push.
  6. As owner, mark "Transfer Requested" urgent → email arrives within ~1 minute; otherwise it appears in the next digest.
  7. Log out → the `PushToken` row is gone.
