# TOOLTRAQ Phase 2a — Nav Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing 5-tab bottom nav with a role-adaptive 2-FAB-2 custom tab bar (elevated center Scan FAB), restore Phase 1's universal-link regression, and retire `src/navigation/TabNavigation.js` + `src/screens/HomeScreen/` in favor of a clean per-tab module structure.

**Architecture:** New `MainTabBar.tsx` custom bottom-tab bar component consumes a declarative `mainTabs.ts` config that returns per-role tab lists. Each tab lives in its own `src/screens/<Name>/` directory with a thin shell screen; business logic in `hooks/`; presentational pieces in `components/`. Scan FAB has no tab screen — it fires NFC directly via a parent-provided `onScanPress` callback, routing to `QuickActionModal` on success. Legacy `deviceService`-dependent screens (QuickActionModal) are kept alive during API v1 migration via a `legacyDeviceShim.ts`.

**Tech Stack:** React Native 0.81.5, Expo SDK 54, React Navigation v7 (`@react-navigation/bottom-tabs`, `@react-navigation/stack`), TypeScript 5.8 (strict: false), Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-22-tooltraq-phase2a-nav-design.md`

**Branch:** `feature/tooltraq-phase2a-nav` off `master`.

---

## Task 1: Worktree + branch setup

**Files:** no code changes.

- [ ] **Step 1: Verify starting state**

Run:
```bash
cd /home/garan/Documents/programming/live-projects/wrapbattz2/app/wrapbattz
git status --short
git log -1 --format="%h %s"
```

Expected: on `master`, HEAD should be `3e52df6 docs: TOOLTRAQ Phase 2a nav restructure design spec` or later. Any unstaged changes are unrelated — don't stage or touch them.

- [ ] **Step 2: Create the worktree + feature branch**

Run:
```bash
git worktree add .worktrees/tooltraq-phase2a-nav -b feature/tooltraq-phase2a-nav master
cd .worktrees/tooltraq-phase2a-nav
git status -sb
```

Expected: `## feature/tooltraq-phase2a-nav` with no uncommitted changes. All subsequent tasks run from this worktree directory.

- [ ] **Step 3: No commit yet** — proceed to Task 2.

---

## Task 2: Linking regression fix — convert `index.js` → `index.tsx`

**Files:**
- Delete: `src/navigation/index.js`
- Create: `src/navigation/index.tsx`

The new file keeps all current behavior and adds: `linking` config + `QuickActionModal` + `VehicleDetailsScreen` stack registrations.

- [ ] **Step 1: Rename the file**

Run:
```bash
git mv src/navigation/index.js src/navigation/index.tsx
```

- [ ] **Step 2: Add `linking` import**

At the top of `src/navigation/index.tsx`, add to the existing imports (right after the `createStackNavigator` import):

```tsx
import type { LinkingOptions } from '@react-navigation/native';
```

- [ ] **Step 3: Add QuickActionModal + VehicleDetailsScreen imports**

In the "Import new screens" block of `src/navigation/index.tsx` (below `ChangePasswordScreen`), add:

```tsx
import QuickActionModalScreen from '../screens/QuickAction/QuickActionModalScreen';
import VehicleDetailsScreen from '../screens/VehicleDetailsScreen';
```

- [ ] **Step 4: Add `linking` config**

After the `const Stack = createStackNavigator();` line in `src/navigation/index.tsx`, add:

```tsx
const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [
    'https://api.tooltraq.com',
    'https://webportal.battwrapz.com',
    'tooltraq://',
    'wrapbattz://',
  ],
  config: {
    screens: {
      QuickActionModal: 'd/:tagUID',
    },
  },
};
```

- [ ] **Step 5: Register `QuickActionModal` + `VehicleDetailsScreen` stack screens**

Inside `MainStack`'s `<Stack.Navigator>`, after the last `<Stack.Screen name="ChangePassword" ... />` (or at the bottom of the existing screens block), add:

```tsx
<Stack.Screen
  name="VehicleDetails"
  component={VehicleDetailsScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="QuickActionModal"
  component={QuickActionModalScreen}
  options={{
    headerShown: false,
    presentation: 'modal',
    gestureEnabled: true,
  }}
/>
```

- [ ] **Step 6: Wire `linking` into `NavigationContainer`**

Find the `<NavigationContainer>` at the bottom of the file (inside the default export / root component) and add the `linking` prop:

```tsx
<NavigationContainer linking={linking}>
  {/* existing children */}
</NavigationContainer>
```

- [ ] **Step 7: TypeScript validation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "(index\.tsx|navigation)" | head -20
```

Expected: no errors related to `src/navigation/index.tsx`. (Other pre-existing TS issues in the codebase are unrelated.)

- [ ] **Step 8: Smoke test**

Run:
```bash
npm test -- --testPathPattern="navigation" 2>&1 | tail -10
```

Expected: no navigation-specific tests fail (or no matches).

- [ ] **Step 9: Commit**

```bash
git add src/navigation/index.tsx
git commit -m "fix(nav): restore universal link config and register QuickActionModal (Phase 1 regression)"
```

---

## Task 3: `mainTabs.ts` — declarative role-gated tab config (TDD)

**Files:**
- Create: `src/navigation/mainTabs.ts`
- Create: `src/navigation/__tests__/mainTabs.test.ts`

This module exports `tabsForRole(role)` returning a 5-element array. Pure function — no screens imported here; components stay decoupled. Components for each tab live in `mainTabs.ts` after the screens are created; for Task 3 we only need the config + test.

- [ ] **Step 1: Write the failing test**

Create `src/navigation/__tests__/mainTabs.test.ts`:

```ts
import { tabsForRole } from '../mainTabs';

describe('tabsForRole', () => {
  it('returns 5 tabs in worker layout for site_worker', () => {
    const tabs = tabsForRole('site_worker');
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'incidents', 'settings']);
  });

  it('returns 5 tabs in worker layout for office_worker', () => {
    const tabs = tabsForRole('office_worker');
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'incidents', 'settings']);
  });

  it('returns 5 tabs in admin layout for admin', () => {
    const tabs = tabsForRole('admin');
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'sites', 'settings']);
  });

  it('returns 5 tabs in admin layout for owner', () => {
    const tabs = tabsForRole('owner');
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'sites', 'settings']);
  });

  it('defaults to worker layout when role is undefined', () => {
    const tabs = tabsForRole(undefined);
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'incidents', 'settings']);
  });

  it('marks scan as a FAB in slot 3', () => {
    const tabs = tabsForRole('admin');
    expect(tabs[2].key).toBe('scan');
    expect(tabs[2].isFab).toBe(true);
  });

  it('no non-scan tab is a FAB', () => {
    const tabs = tabsForRole('admin');
    tabs.filter(t => t.key !== 'scan').forEach(t => {
      expect(t.isFab).toBeFalsy();
    });
  });
});
```

- [ ] **Step 2: Run test — expected to fail (no module)**

Run:
```bash
npm test -- --testPathPattern="mainTabs.test" 2>&1 | tail -15
```

Expected: FAIL with "Cannot find module '../mainTabs'".

- [ ] **Step 3: Implement `mainTabs.ts`**

Create `src/navigation/mainTabs.ts`:

```ts
export type TabKey = 'dashboard' | 'tools' | 'scan' | 'incidents' | 'sites' | 'settings';
export type Role = 'owner' | 'admin' | 'office_worker' | 'site_worker';

export interface TabConfig {
  key: TabKey;
  label: string;
  icon: string;
  iconFocused: string;
  isFab?: boolean;
}

const ALL_TABS: Record<TabKey, TabConfig> = {
  dashboard: { key: 'dashboard', label: 'Dashboard', icon: 'home-outline', iconFocused: 'home' },
  tools:     { key: 'tools',     label: 'Tools',     icon: 'construct-outline', iconFocused: 'construct' },
  scan:      { key: 'scan',      label: 'Scan',      icon: 'scan-circle-outline', iconFocused: 'scan-circle', isFab: true },
  incidents: { key: 'incidents', label: 'Incidents', icon: 'document-text-outline', iconFocused: 'document-text' },
  sites:     { key: 'sites',     label: 'Sites',     icon: 'business-outline', iconFocused: 'business' },
  settings:  { key: 'settings',  label: 'Settings',  icon: 'settings-outline', iconFocused: 'settings' },
};

export function tabsForRole(role: Role | undefined): TabConfig[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  const keys: TabKey[] = isAdminOrOwner
    ? ['dashboard', 'tools', 'scan', 'sites', 'settings']
    : ['dashboard', 'tools', 'scan', 'incidents', 'settings'];
  return keys.map(k => ALL_TABS[k]);
}
```

(Note: `component` field deferred — added in Task 12 when the MainTabNavigator wires screens in. Keeping `mainTabs.ts` component-free right now lets us unit-test it without JSX/React dependencies.)

- [ ] **Step 4: Run test — expected to pass**

Run:
```bash
npm test -- --testPathPattern="mainTabs.test" 2>&1 | tail -10
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/mainTabs.ts src/navigation/__tests__/mainTabs.test.ts
git commit -m "feat(nav): add role-gated tab config (mainTabs.ts)"
```

---

## Task 4: `MainTabBar.tsx` — custom bottom tab bar (TDD)

**Files:**
- Create: `src/navigation/MainTabBar.tsx`
- Create: `src/navigation/__tests__/MainTabBar.test.tsx`

Custom tab bar for `createBottomTabNavigator`. Renders 4 regular tabs + 1 FAB in a 5-slot row. Gets role from `useAuth()`, looks up tabs via `tabsForRole()`. FAB invokes `onScanPress` prop, never navigates.

- [ ] **Step 1: Write the failing test**

Create `src/navigation/__tests__/MainTabBar.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import MainTabBar from '../MainTabBar';

// Mock useAuth
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { role: 'admin' } }),
}));

// Minimal BottomTabBarProps stub
const makeProps = (overrides = {}) => ({
  state: {
    index: 0,
    routes: [
      { key: 'dashboard', name: 'dashboard' },
      { key: 'tools', name: 'tools' },
      { key: 'sites', name: 'sites' },
      { key: 'settings', name: 'settings' },
    ],
  },
  descriptors: {},
  navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  ...overrides,
});

describe('MainTabBar', () => {
  it('renders 5 slots including the Scan FAB', () => {
    render(<MainTabBar {...(makeProps() as any)} onScanPress={jest.fn()} />);
    expect(screen.getByLabelText('Dashboard')).toBeTruthy();
    expect(screen.getByLabelText('Tools')).toBeTruthy();
    expect(screen.getByLabelText('Scan NFC tag')).toBeTruthy();
    expect(screen.getByLabelText('Sites')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });

  it('invokes onScanPress when FAB is tapped', () => {
    const onScanPress = jest.fn();
    render(<MainTabBar {...(makeProps() as any)} onScanPress={onScanPress} />);
    fireEvent.press(screen.getByLabelText('Scan NFC tag'));
    expect(onScanPress).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when Scan FAB is tapped', () => {
    const navigate = jest.fn();
    const props = makeProps({ navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate } });
    render(<MainTabBar {...(props as any)} onScanPress={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Scan NFC tag'));
    expect(navigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expected to fail (no module)**

Run:
```bash
npm test -- --testPathPattern="MainTabBar.test" 2>&1 | tail -15
```

Expected: FAIL with "Cannot find module '../MainTabBar'".

- [ ] **Step 3: Implement `MainTabBar.tsx`**

Create `src/navigation/MainTabBar.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { tabsForRole, TabConfig } from './mainTabs';

interface Props extends BottomTabBarProps {
  onScanPress: () => void;
}

const MainTabBar: React.FC<Props> = ({ state, navigation, insets, onScanPress }) => {
  const { colors } = useTheme();
  const { userData } = useAuth();
  const tabs = tabsForRole(userData?.role as any);

  const renderRegularTab = (tab: TabConfig, routeIndex: number) => {
    const focused = state.routes[routeIndex]?.name === tab.key && state.index === routeIndex;
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes[routeIndex]?.key,
        canPreventDefault: true,
      } as any);
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(tab.key);
      }
    };
    const tint = focused ? colors.primary : colors.textMuted;
    return (
      <TouchableOpacity
        key={tab.key}
        style={styles.tab}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: focused }}
        activeOpacity={0.7}
      >
        <Ionicons name={(focused ? tab.iconFocused : tab.icon) as any} size={24} color={tint} />
        <Text style={[styles.label, { color: tint }]}>{tab.label}</Text>
      </TouchableOpacity>
    );
  };

  const renderFab = (tab: TabConfig) => (
    <View key={tab.key} style={styles.fabSlot}>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={onScanPress}
        accessibilityRole="button"
        accessibilityLabel="Scan NFC tag"
        accessibilityHint="Starts the NFC reader to scan a tool"
        activeOpacity={0.85}
      >
        <Ionicons name={tab.iconFocused as any} size={30} color={(colors as any).onPrimary ?? '#0F1722'} />
      </TouchableOpacity>
      <Text style={[styles.fabLabel, { color: colors.primary }]}>{tab.label}</Text>
    </View>
  );

  // Map each tab to a route index; scan has no route
  let routeIndex = 0;
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10),
          height: (Platform.OS === 'ios' ? 80 : 64) + insets.bottom,
        },
      ]}
    >
      {tabs.map(tab => {
        if (tab.isFab) return renderFab(tab);
        return renderRegularTab(tab, routeIndex++);
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 10,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -20,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default MainTabBar;
```

- [ ] **Step 4: Run test — expected to pass**

Run:
```bash
npm test -- --testPathPattern="MainTabBar.test" 2>&1 | tail -10
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/MainTabBar.tsx src/navigation/__tests__/MainTabBar.test.tsx
git commit -m "feat(nav): add MainTabBar custom bottom tab bar with Scan FAB"
```

---

## Task 5: `legacyDeviceShim.ts` — keep QuickActionModal alive during API v1 migration

**Files:**
- Create: `src/services/legacyDeviceShim.ts`
- Modify: `src/screens/QuickAction/QuickActionModalScreen.tsx` (swap `deviceService` import + usage for the shim)

QuickActionModal currently imports `deviceService` from AuthContext, but that field was removed during API v1 migration. Until API v1 Phase 4/5 ships, the shim returns graceful empty responses with user-visible alerts.

- [ ] **Step 1: Create `src/services/legacyDeviceShim.ts`**

```ts
import { Alert } from 'react-native';

const MIGRATION_MSG =
  'This feature is being migrated to the new API. Your action was registered; full functionality returns once migration lands.';

function notifyMigration() {
  Alert.alert('Feature migrating', MIGRATION_MSG);
}

export interface LegacyDevice {
  id: string | number;
  identifier?: string;
  make?: string;
  model?: string;
  device_type?: string;
  serial_number?: string;
  maintenance_interval?: number;
  description?: string;
  current_assignment?: {
    id: string;
    user_name?: string;
    location_name?: string;
  } | null;
}

export const legacyDeviceShim = {
  async getDeviceByNfcUuid(_tagUid: string): Promise<LegacyDevice | null> {
    notifyMigration();
    return null;
  },

  async getLocations(): Promise<any[]> {
    return [];
  },

  async getVans(): Promise<any[]> {
    return [];
  },

  async returnDeviceToLocation(_assignmentId: string, _body: { location: string }): Promise<void> {
    notifyMigration();
  },
};
```

- [ ] **Step 2: Update `QuickActionModalScreen.tsx` to use the shim**

In `src/screens/QuickAction/QuickActionModalScreen.tsx`:

Find this line near the top:
```tsx
const { deviceService, isAdminOrOwner } = useAuth();
```

Replace with:
```tsx
const { isAdminOrOwner } = useAuth();
```

Add a new import below the `useAuth` import:
```tsx
import { legacyDeviceShim as deviceService } from '../../services/legacyDeviceShim';
```

(Aliasing `legacyDeviceShim as deviceService` keeps the rest of the file's `deviceService.getDeviceByNfcUuid(...)`, `deviceService.getLocations()`, etc. calls unchanged — swap the *source* only, preserve the call sites.)

- [ ] **Step 3: Quick TypeScript + test check**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "QuickActionModal|legacyDeviceShim" | head -10
npm test -- --testPathPattern="QuickAction" 2>&1 | tail -10
```

Expected: no TypeScript errors in either file; no QuickAction tests exist so test output is "no tests matched".

- [ ] **Step 4: Commit**

```bash
git add src/services/legacyDeviceShim.ts src/screens/QuickAction/QuickActionModalScreen.tsx
git commit -m "feat(nav): add legacyDeviceShim to keep QuickActionModal alive during API v1 migration"
```

---

## Task 6: Shared `useScanTag` hook + Dashboard shell

**Files:**
- Create: `src/hooks/useScanTag.ts`
- Create: `src/screens/Dashboard/quickActions.ts`
- Create: `src/screens/Dashboard/components/QuickActionsGrid.tsx`
- Create: `src/screens/Dashboard/components/DataOverview.tsx`
- Create: `src/screens/Dashboard/hooks/useDashboardStats.ts`
- Create: `src/screens/Dashboard/DashboardScreen.tsx`
- Create: `src/screens/Dashboard/index.ts`
- Create: `src/screens/Dashboard/__tests__/quickActions.test.ts`
- Create: `src/screens/Dashboard/__tests__/DashboardScreen.test.tsx`

`useScanTag()` is the single source of truth for "start NFC reader → route to QuickActionModal on success". Both the Scan FAB in `MainTabBar` (via `MainTabNavigator` in Task 11) and the Scan tile on the Dashboard use it.

- [ ] **Step 0: Create `src/hooks/useScanTag.ts`**

```ts
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { nfcService } from '../services/NFCService';

export interface UseScanTagResult {
  scan: () => Promise<void>;
}

/**
 * Starts the NFC reader and routes to QuickActionModal on success. Shared by the
 * center Scan FAB (MainTabBar) and the Scan tile on the Dashboard so both paths
 * have identical behavior, error handling, and cancellation semantics.
 */
export function useScanTag(): UseScanTagResult {
  const navigation = useNavigation<any>();

  const scan = useCallback(async () => {
    try {
      const result = await nfcService.readNFC();
      if (result.success && (result.data as any)?.tagId) {
        const tagUID = String((result.data as any).tagId).toUpperCase();
        navigation.navigate('QuickActionModal', { tagUID });
        return;
      }
      Alert.alert('NFC read failed', result.error || 'No tag detected. Please try again.');
    } catch (err: any) {
      const msg = err?.message || 'Please try again.';
      if (/cancelled|not available|disabled/i.test(msg)) return;
      Alert.alert('NFC read failed', msg);
    }
  }, [navigation]);

  return { scan };
}
```

- [ ] **Step 1: Write the failing test for `quickActions.ts`**

Create `src/screens/Dashboard/__tests__/quickActions.test.ts`:

```ts
import { quickActionsForRole } from '../quickActions';

describe('quickActionsForRole', () => {
  it('returns 4 tiles for site_worker', () => {
    expect(quickActionsForRole('site_worker')).toHaveLength(4);
  });
  it('returns 4 tiles for office_worker', () => {
    expect(quickActionsForRole('office_worker')).toHaveLength(4);
  });
  it('returns 8 tiles for admin', () => {
    expect(quickActionsForRole('admin')).toHaveLength(8);
  });
  it('returns 8 tiles for owner', () => {
    expect(quickActionsForRole('owner')).toHaveLength(8);
  });
  it('admin tiles contain Billing and Invite User', () => {
    const keys = quickActionsForRole('admin').map(a => a.key);
    expect(keys).toContain('billing');
    expect(keys).toContain('inviteUser');
  });
  it('worker tiles do not contain Billing or Invite User', () => {
    const keys = quickActionsForRole('site_worker').map(a => a.key);
    expect(keys).not.toContain('billing');
    expect(keys).not.toContain('inviteUser');
  });
});
```

- [ ] **Step 2: Run — expected to fail**

```bash
npm test -- --testPathPattern="Dashboard.*quickActions" 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/screens/Dashboard/quickActions.ts`**

```ts
import type { Role } from '../../navigation/mainTabs';

export interface QuickAction {
  key: string;
  label: string;
  icon: string;
  destination?: string;
  onPressType?: 'scan';
}

const WORKER_ACTIONS: QuickAction[] = [
  { key: 'scan',          label: 'Scan',          icon: 'scan-circle-outline', onPressType: 'scan' },
  { key: 'reportIssue',   label: 'Report Issue',  icon: 'alert-circle-outline', destination: 'CreateReport' },
  { key: 'myTools',       label: 'My Tools',      icon: 'construct-outline',    destination: 'MainTabs' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', destination: 'NotificationPreferences' },
];

const ADMIN_EXTRAS: QuickAction[] = [
  { key: 'addTool',    label: 'Add Tool',    icon: 'add-circle-outline',   destination: 'AddDevice' },
  { key: 'sites',      label: 'Sites',       icon: 'business-outline',     destination: 'MainTabs' },
  { key: 'inviteUser', label: 'Invite User', icon: 'person-add-outline',   destination: 'Members' },
  { key: 'billing',    label: 'Billing',     icon: 'card-outline',         destination: 'ManageBilling' },
];

export function quickActionsForRole(role: Role | undefined): QuickAction[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  return isAdminOrOwner ? [...WORKER_ACTIONS, ...ADMIN_EXTRAS] : WORKER_ACTIONS;
}
```

- [ ] **Step 4: Run — expected to pass**

```bash
npm test -- --testPathPattern="Dashboard.*quickActions" 2>&1 | tail -10
```

Expected: all 6 tests pass.

- [ ] **Step 5: Create `src/screens/Dashboard/hooks/useDashboardStats.ts`**

```ts
import type { Role } from '../../../navigation/mainTabs';

export interface WorkerStats {
  toolsAssigned: number;
  openIncidents: number;
  sites: number;
}

export interface AdminStats {
  activeTools: number;
  inUse: number;
  missing: number;
  maintenanceDue: number;
}

export interface DashboardStats {
  isLoading: boolean;
  role: 'worker' | 'admin';
  worker?: WorkerStats;
  admin?: AdminStats;
}

export function useDashboardStats(role: Role | undefined): DashboardStats {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  return {
    isLoading: true,
    role: isAdminOrOwner ? 'admin' : 'worker',
    worker: isAdminOrOwner ? undefined : { toolsAssigned: 0, openIncidents: 0, sites: 0 },
    admin: isAdminOrOwner ? { activeTools: 0, inUse: 0, missing: 0, maintenanceDue: 0 } : undefined,
  };
}
```

The hook is a stub: Phase 2a always returns `isLoading: true` so the UI shows skeleton state. API v1 Phase 4/5 replaces the body with real fetches.

- [ ] **Step 6: Create `src/screens/Dashboard/components/DataOverview.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import type { DashboardStats } from '../hooks/useDashboardStats';

interface Props {
  stats: DashboardStats;
}

const DataOverview: React.FC<Props> = ({ stats }) => {
  const { colors } = useTheme();
  if (stats.isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.card }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading stats…</Text>
      </View>
    );
  }
  if (stats.role === 'worker' && stats.worker) {
    return (
      <View style={styles.row}>
        <StatChip label="Tools" value={stats.worker.toolsAssigned} />
        <StatChip label="Incidents" value={stats.worker.openIncidents} />
        <StatChip label="Sites" value={stats.worker.sites} />
      </View>
    );
  }
  if (stats.role === 'admin' && stats.admin) {
    return (
      <View style={styles.grid}>
        <StatCard label="Active Tools" value={stats.admin.activeTools} />
        <StatCard label="In Use" value={stats.admin.inUse} />
        <StatCard label="Missing" value={stats.admin.missing} tone="danger" />
        <StatCard label="Maintenance Due" value={stats.admin.maintenanceDue} tone="warning" />
      </View>
    );
  }
  return null;
};

const StatChip: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.card }]}>
      <Text style={[styles.chipValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const StatCard: React.FC<{ label: string; value: number; tone?: 'danger' | 'warning' }> = ({ label, value, tone }) => {
  const { colors } = useTheme();
  const valueColor =
    tone === 'danger' ? colors.error :
    tone === 'warning' ? colors.warning :
    colors.primary;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.cardValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  loader: { padding: 20, alignItems: 'center', borderRadius: 10 },
  loadingText: { marginTop: 8, fontSize: 13 },
  row: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10 },
  chipValue: { fontSize: 20, fontWeight: '800' },
  chipLabel: { fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', padding: 16, borderRadius: 12 },
  cardValue: { fontSize: 28, fontWeight: '800' },
  cardLabel: { fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
});

export default DataOverview;
```

- [ ] **Step 7: Create `src/screens/Dashboard/components/QuickActionsGrid.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import type { QuickAction } from '../quickActions';

interface Props {
  actions: QuickAction[];
  onActionPress: (action: QuickAction) => void;
}

const QuickActionsGrid: React.FC<Props> = ({ actions, onActionPress }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {actions.map(a => (
        <TouchableOpacity
          key={a.key}
          style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onActionPress(a)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          activeOpacity={0.7}
        >
          <Ionicons name={a.icon as any} size={28} color={colors.primary} />
          <Text style={[styles.label, { color: colors.textPrimary }]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  tile: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 88,
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center' },
});

export default QuickActionsGrid;
```

- [ ] **Step 8: Write the failing test for `DashboardScreen`**

Create `src/screens/Dashboard/__tests__/DashboardScreen.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import DashboardScreen from '../DashboardScreen';

let currentRole: any = 'site_worker';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { role: currentRole } }),
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe('DashboardScreen', () => {
  beforeEach(() => { mockNavigate.mockClear(); });

  it('renders 4 QuickAction tiles for worker role', () => {
    currentRole = 'site_worker';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Scan')).toBeTruthy();
    expect(screen.getByLabelText('Report Issue')).toBeTruthy();
    expect(screen.getByLabelText('My Tools')).toBeTruthy();
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
  });

  it('renders 8 QuickAction tiles for admin role', () => {
    currentRole = 'admin';
    render(<DashboardScreen />);
    // Admin extras:
    expect(screen.getByLabelText('Add Tool')).toBeTruthy();
    expect(screen.getByLabelText('Sites')).toBeTruthy();
    expect(screen.getByLabelText('Invite User')).toBeTruthy();
    expect(screen.getByLabelText('Billing')).toBeTruthy();
  });
});
```

- [ ] **Step 9: Create `src/screens/Dashboard/DashboardScreen.tsx`**

```tsx
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { quickActionsForRole, QuickAction } from './quickActions';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useScanTag } from '../../hooks/useScanTag';
import QuickActionsGrid from './components/QuickActionsGrid';
import DataOverview from './components/DataOverview';

const DashboardScreen: React.FC = () => {
  const { userData } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const role = userData?.role as any;
  const actions = quickActionsForRole(role);
  const stats = useDashboardStats(role);
  const { scan } = useScanTag();

  const handleAction = (a: QuickAction) => {
    if (a.onPressType === 'scan') {
      scan();
      return;
    }
    if (a.destination) navigation.navigate(a.destination);
  };

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
      <QuickActionsGrid actions={actions} onActionPress={handleAction} />
      <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>Overview</Text>
      <DataOverview stats={stats} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
});

export default DashboardScreen;
```

- [ ] **Step 10: Create `src/screens/Dashboard/index.ts`**

```ts
export { default } from './DashboardScreen';
```

- [ ] **Step 11: Run all Dashboard tests**

```bash
npm test -- --testPathPattern="Dashboard" 2>&1 | tail -15
```

Expected: 8 total tests pass (6 quickActions + 2 DashboardScreen).

- [ ] **Step 12: Commit**

```bash
git add src/screens/Dashboard/ src/hooks/useScanTag.ts
git commit -m "feat(dashboard): add Dashboard + useScanTag hook shared by FAB and Scan tile"
```

---

## Task 7: Tools screen shell with role-adaptive list

**Files:**
- Create: `src/screens/Tools/ToolsScreen.tsx`
- Create: `src/screens/Tools/hooks/useMyTools.ts`
- Create: `src/screens/Tools/components/SiteGroupHeader.tsx`
- Create: `src/screens/Tools/components/ToolsListItem.tsx`
- Create: `src/screens/Tools/components/AdminToolsToggle.tsx`
- Create: `src/screens/Tools/index.ts`

- [ ] **Step 1: Create `src/screens/Tools/hooks/useMyTools.ts`**

```ts
import { useState } from 'react';

export interface ToolItem {
  id: string;
  identifier: string;
  toolType?: string;
  status: 'assigned' | 'available' | 'missing' | 'maintenance';
}

export interface SiteGroup {
  siteId: string;
  siteName: string;
  siteType: 'location' | 'van' | 'toolbox';
  tools: ToolItem[];
}

export interface UseMyToolsResult {
  isLoading: boolean;
  groups: SiteGroup[];
  filter: 'mine' | 'all';
  setFilter: (f: 'mine' | 'all') => void;
}

export function useMyTools(): UseMyToolsResult {
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  return { isLoading: false, groups: [], filter, setFilter };
}
```

The hook is a Phase 2a stub — always returns empty groups. API v1 Phase 4/5 will replace the body.

- [ ] **Step 2: Create `src/screens/Tools/components/SiteGroupHeader.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import type { SiteGroup } from '../hooks/useMyTools';

const ICON: Record<SiteGroup['siteType'], string> = {
  location: '📍',
  van: '🚐',
  toolbox: '🧰',
};

const SiteGroupHeader: React.FC<{ group: SiteGroup }> = ({ group }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {ICON[group.siteType]}  {group.siteName}
      </Text>
      <Text style={[styles.count, { color: colors.textSecondary }]}>{group.tools.length} tools</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 12 },
});

export default SiteGroupHeader;
```

- [ ] **Step 3: Create `src/screens/Tools/components/ToolsListItem.tsx`**

```tsx
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import type { ToolItem } from '../hooks/useMyTools';

interface Props {
  item: ToolItem;
  onPress: (item: ToolItem) => void;
}

const STATUS_COLOR: Record<ToolItem['status'], 'primary' | 'success' | 'error' | 'warning'> = {
  assigned: 'primary',
  available: 'success',
  missing: 'error',
  maintenance: 'warning',
};

const ToolsListItem: React.FC<Props> = ({ item, onPress }) => {
  const { colors } = useTheme();
  const chipColor = colors[STATUS_COLOR[item.status]];
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.info}>
        <Text style={[styles.identifier, { color: colors.textPrimary }]}>{item.identifier}</Text>
        {item.toolType ? <Text style={[styles.type, { color: colors.textSecondary }]}>{item.toolType}</Text> : null}
      </View>
      <View style={[styles.statusChip, { backgroundColor: chipColor + '22', borderColor: chipColor }]}>
        <Text style={[styles.statusText, { color: chipColor }]}>{item.status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  info: { flex: 1 },
  identifier: { fontSize: 15, fontWeight: '600' },
  type: { fontSize: 12, marginTop: 2 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, marginRight: 8 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});

export default ToolsListItem;
```

- [ ] **Step 4: Create `src/screens/Tools/components/AdminToolsToggle.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';

interface Props {
  value: 'mine' | 'all';
  onChange: (next: 'mine' | 'all') => void;
}

const AdminToolsToggle: React.FC<Props> = ({ value, onChange }) => {
  const { colors } = useTheme();
  const Option = (key: 'mine' | 'all', label: string) => {
    const active = value === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.opt, { backgroundColor: active ? colors.primary : 'transparent' }]}
        onPress={() => onChange(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.optText, { color: active ? (colors as any).onPrimary : colors.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      {Option('mine', 'My Tools')}
      {Option('all', 'All Org Tools')}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: 8, padding: 2, borderWidth: StyleSheet.hairlineWidth },
  opt: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  optText: { fontSize: 13, fontWeight: '600' },
});

export default AdminToolsToggle;
```

- [ ] **Step 5: Create `src/screens/Tools/ToolsScreen.tsx`**

```tsx
import React from 'react';
import { SectionList, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMyTools, ToolItem } from './hooks/useMyTools';
import SiteGroupHeader from './components/SiteGroupHeader';
import ToolsListItem from './components/ToolsListItem';
import AdminToolsToggle from './components/AdminToolsToggle';

const ToolsScreen: React.FC = () => {
  const { userData } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { isLoading, groups, filter, setFilter } = useMyTools();
  const isAdminOrOwner = userData?.role === 'admin' || userData?.role === 'owner';

  const sections = groups.map(g => ({ title: g.siteName, data: g.tools, group: g }));

  const handleToolPress = (t: ToolItem) => navigation.navigate('DeviceDetails', { deviceId: t.id });

  if (isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading tools…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {isAdminOrOwner ? (
        <View style={styles.toggleWrap}>
          <AdminToolsToggle value={filter} onChange={setFilter} />
        </View>
      ) : null}
      <SectionList
        sections={sections as any}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => <SiteGroupHeader group={(section as any).group} />}
        renderItem={({ item }) => <ToolsListItem item={item} onPress={handleToolPress} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No tools yet. Tap Scan to check a tag.
            </Text>
          </View>
        }
        stickySectionHeadersEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  toggleWrap: { padding: 12 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 10, fontSize: 14 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});

export default ToolsScreen;
```

- [ ] **Step 6: Create `src/screens/Tools/index.ts`**

```ts
export { default } from './ToolsScreen';
```

- [ ] **Step 7: Type check + test run**

```bash
npx tsc --noEmit 2>&1 | grep -E "screens/Tools" | head -10
npm test 2>&1 | tail -5
```

Expected: no TS errors in Tools/. Test baseline unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/screens/Tools/
git commit -m "feat(tools): add Tools tab shell with site-grouped list and admin toggle"
```

---

## Task 8: Sites wrapper (thin re-export of LocationsScreen)

**Files:**
- Create: `src/screens/Sites/SitesScreen.tsx`
- Create: `src/screens/Sites/index.ts`

- [ ] **Step 1: Create `src/screens/Sites/SitesScreen.tsx`**

```tsx
// Phase 2a: thin wrapper over the existing LocationsScreen.
// Phase 2b / API v1 Phase 5 will evolve this into its own screen (vehicle/toolbox site types, etc.).
import LocationsScreen from '../LocationsScreen';

export default LocationsScreen;
```

- [ ] **Step 2: Create `src/screens/Sites/index.ts`**

```ts
export { default } from './SitesScreen';
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/Sites/
git commit -m "feat(sites): add Sites tab wrapper re-exporting LocationsScreen"
```

---

## Task 9: Incidents wrapper (thin re-export of ReportsScreen)

**Files:**
- Create: `src/screens/Incidents/IncidentsScreen.tsx`
- Create: `src/screens/Incidents/index.ts`

- [ ] **Step 1: Create `src/screens/Incidents/IncidentsScreen.tsx`**

```tsx
// Phase 2a: thin wrapper over the existing ReportsScreen.
// Phase 2b / API v1 Phase 6 will evolve this into its own screen (true incident list).
import ReportsScreen from '../ReportsScreen';

export default ReportsScreen;
```

- [ ] **Step 2: Create `src/screens/Incidents/index.ts`**

```ts
export { default } from './IncidentsScreen';
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/Incidents/
git commit -m "feat(incidents): add Incidents tab wrapper re-exporting ReportsScreen"
```

---

## Task 10: Settings tab — sections config (TDD) + screen + row components

**Files:**
- Create: `src/screens/Settings/sections.ts`
- Create: `src/screens/Settings/__tests__/sections.test.ts`
- Create: `src/screens/Settings/components/SettingsRow.tsx`
- Create: `src/screens/Settings/components/SettingsSectionHeader.tsx`
- Create: `src/screens/Settings/components/ThemePickerRow.tsx`
- Create: `src/screens/Settings/SettingsScreen.tsx`
- Create: `src/screens/Settings/index.ts`

- [ ] **Step 1: Write the failing test for `sections.ts`**

Create `src/screens/Settings/__tests__/sections.test.ts`:

```ts
import { getSectionsForRole } from '../sections';

describe('getSectionsForRole', () => {
  it('returns Account, Preferences, Support, Logout for worker', () => {
    const keys = getSectionsForRole('site_worker').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'support', 'logout']);
  });

  it('returns all 6 sections for admin', () => {
    const keys = getSectionsForRole('admin').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'billing', 'support', 'logout']);
  });

  it('returns all 6 sections for owner', () => {
    const keys = getSectionsForRole('owner').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'billing', 'support', 'logout']);
  });

  it('worker does not see Organization or Billing sections', () => {
    const keys = getSectionsForRole('office_worker').map(s => s.key);
    expect(keys).not.toContain('organization');
    expect(keys).not.toContain('billing');
  });

  it('Logout section has exactly one destructive action row', () => {
    const logout = getSectionsForRole('admin').find(s => s.key === 'logout')!;
    expect(logout.rows).toHaveLength(1);
    expect(logout.rows[0].kind).toBe('action');
    expect(logout.rows[0].destructive).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expected to fail**

```bash
npm test -- --testPathPattern="Settings.*sections" 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/screens/Settings/sections.ts`**

```ts
import type { Role } from '../../navigation/mainTabs';

export type RoleGate = 'all' | 'admin';

export interface SettingsRow {
  key: string;
  label: string;
  icon: string;
  kind: 'nav' | 'action' | 'themePicker';
  destination?: string;
  onPressType?: 'logout';
  destructive?: boolean;
}

export interface SettingsSection {
  key: string;
  title: string;
  requiredRole: RoleGate;
  rows: SettingsRow[];
}

const ALL_SECTIONS: SettingsSection[] = [
  {
    key: 'account',
    title: 'Account',
    requiredRole: 'all',
    rows: [
      { key: 'profile',        label: 'Profile',              icon: 'person-circle-outline', kind: 'nav', destination: 'EditProfile' },
      { key: 'changePassword', label: 'Change Password',      icon: 'key-outline',           kind: 'nav', destination: 'ChangePassword' },
      { key: 'security',       label: 'Biometric & PIN',      icon: 'finger-print-outline',  kind: 'nav', destination: 'SecurityPreferences' },
    ],
  },
  {
    key: 'preferences',
    title: 'Preferences',
    requiredRole: 'all',
    rows: [
      { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', kind: 'nav', destination: 'NotificationPreferences' },
      { key: 'theme',         label: 'Theme',         icon: 'color-palette-outline', kind: 'themePicker' },
    ],
  },
  {
    key: 'organization',
    title: 'Organization',
    requiredRole: 'admin',
    rows: [
      { key: 'orgDetails', label: 'Org Details', icon: 'business-outline',  kind: 'nav', destination: 'CreateOrganization' },
      { key: 'members',    label: 'Members',     icon: 'people-outline',    kind: 'nav', destination: 'Members' },
      { key: 'inviteCode', label: 'Invite Code', icon: 'link-outline',      kind: 'nav', destination: 'InviteCode' },
    ],
  },
  {
    key: 'billing',
    title: 'Billing',
    requiredRole: 'admin',
    rows: [
      { key: 'manageBilling',    label: 'Manage Billing',      icon: 'card-outline',      kind: 'nav', destination: 'ManageBilling' },
      { key: 'paymentHistory',   label: 'Payment History',     icon: 'receipt-outline',   kind: 'nav', destination: 'PaymentHistory' },
      { key: 'dataHandlingFee',  label: 'Data Handling Fee',   icon: 'document-outline',  kind: 'nav', destination: 'DataHandlingFee' },
      { key: 'billingAnalytics', label: 'Billing Analytics',   icon: 'stats-chart-outline', kind: 'nav', destination: 'BillingAnalytics' },
    ],
  },
  {
    key: 'support',
    title: 'Support',
    requiredRole: 'all',
    rows: [
      { key: 'suggestFeature', label: 'Suggest a Feature', icon: 'bulb-outline',      kind: 'nav', destination: 'SuggestFeature' },
      { key: 'about',          label: 'About',             icon: 'information-circle-outline', kind: 'nav', destination: 'About' },
    ],
  },
  {
    key: 'logout',
    title: '',
    requiredRole: 'all',
    rows: [
      { key: 'logout', label: 'Logout', icon: 'log-out-outline', kind: 'action', onPressType: 'logout', destructive: true },
    ],
  },
];

export function getSectionsForRole(role: Role | undefined): SettingsSection[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  return ALL_SECTIONS.filter(s => s.requiredRole === 'all' || isAdminOrOwner);
}
```

- [ ] **Step 4: Run — expected to pass**

```bash
npm test -- --testPathPattern="Settings.*sections" 2>&1 | tail -10
```

Expected: all 5 tests pass.

- [ ] **Step 5: Create `src/screens/Settings/components/SettingsRow.tsx`**

```tsx
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import type { SettingsRow as SettingsRowConfig } from '../sections';

interface Props {
  row: SettingsRowConfig;
  onPress: (row: SettingsRowConfig) => void;
}

const SettingsRow: React.FC<Props> = ({ row, onPress }) => {
  const { colors } = useTheme();
  const color = row.destructive ? colors.error : colors.textPrimary;
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}
      onPress={() => onPress(row)}
      accessibilityRole="button"
      accessibilityLabel={row.label}
      activeOpacity={0.7}
    >
      <Ionicons name={row.icon as any} size={22} color={color} />
      <Text style={[styles.label, { color }]}>{row.label}</Text>
      {row.kind === 'nav' ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 14 },
  label: { flex: 1, fontSize: 15, fontWeight: '500' },
});

export default SettingsRow;
```

- [ ] **Step 6: Create `src/screens/Settings/components/SettingsSectionHeader.tsx`**

```tsx
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';

const SettingsSectionHeader: React.FC<{ title: string }> = ({ title }) => {
  const { colors } = useTheme();
  if (!title) return null;
  return <Text style={[styles.title, { color: colors.textSecondary, backgroundColor: colors.background }]}>{title.toUpperCase()}</Text>;
};

const styles = StyleSheet.create({
  title: { fontSize: 12, fontWeight: '700', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, letterSpacing: 0.5 },
});

export default SettingsSectionHeader;
```

- [ ] **Step 7: Create `src/screens/Settings/components/ThemePickerRow.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';

type Mode = 'system' | 'light' | 'dark';

const ThemePickerRow: React.FC = () => {
  const { colors, themeMode, setThemeMode } = useTheme();
  const options: { key: Mode; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];
  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
      <View style={styles.header}>
        <Ionicons name="color-palette-outline" size={22} color={colors.textPrimary} />
        <Text style={[styles.label, { color: colors.textPrimary }]}>Theme</Text>
      </View>
      <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
        {options.map(o => {
          const active = themeMode === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.opt, active && { backgroundColor: colors.primary }]}
              onPress={() => setThemeMode(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.optText, { color: active ? (colors as any).onPrimary : colors.textSecondary }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { fontSize: 15, fontWeight: '500' },
  segmented: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  opt: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  optText: { fontSize: 13, fontWeight: '600' },
});

export default ThemePickerRow;
```

- [ ] **Step 8: Create `src/screens/Settings/SettingsScreen.tsx`**

```tsx
import React from 'react';
import { SectionList, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getSectionsForRole, SettingsRow as SettingsRowConfig } from './sections';
import SettingsRow from './components/SettingsRow';
import SettingsSectionHeader from './components/SettingsSectionHeader';
import ThemePickerRow from './components/ThemePickerRow';

const SettingsScreen: React.FC = () => {
  const { userData, logout } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const sections = getSectionsForRole(userData?.role as any);

  const handleRowPress = (row: SettingsRowConfig) => {
    if (row.kind === 'nav' && row.destination) {
      navigation.navigate(row.destination);
      return;
    }
    if (row.kind === 'action' && row.onPressType === 'logout') {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => {
          try { await logout(); } catch { Alert.alert('Error', 'Failed to logout.'); }
        } },
      ], { cancelable: true });
      return;
    }
  };

  const data = sections.map(s => ({ title: s.title, key: s.key, data: s.rows }));

  return (
    <SectionList
      style={[styles.root, { backgroundColor: colors.background }]}
      sections={data as any}
      keyExtractor={item => item.key}
      renderSectionHeader={({ section }) => <SettingsSectionHeader title={(section as any).title} />}
      renderItem={({ item }) => {
        if (item.kind === 'themePicker') return <ThemePickerRow />;
        return <SettingsRow row={item} onPress={handleRowPress} />;
      }}
      stickySectionHeadersEnabled={false}
    />
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default SettingsScreen;
```

- [ ] **Step 9: Create `src/screens/Settings/index.ts`**

```ts
export { default } from './SettingsScreen';
```

- [ ] **Step 10: Type check + full Settings test pass**

```bash
npx tsc --noEmit 2>&1 | grep -E "screens/Settings" | head -10
npm test -- --testPathPattern="Settings" 2>&1 | tail -10
```

Expected: no TS errors in Settings/; 5 sections.test.ts tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/screens/Settings/
git commit -m "feat(settings): add Settings tab with role-gated sections, rows, and theme picker"
```

---

## Task 11: `MainTabNavigator` — new bottom tab navigator that uses `MainTabBar`

**Files:**
- Create: `src/navigation/MainTabNavigator.tsx`

- [ ] **Step 1: Create `src/navigation/MainTabNavigator.tsx`**

```tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MainTabBar from './MainTabBar';
import DashboardScreen from '../screens/Dashboard';
import ToolsScreen from '../screens/Tools';
import IncidentsScreen from '../screens/Incidents';
import SitesScreen from '../screens/Sites';
import SettingsScreen from '../screens/Settings';
import { useAuth } from '../context/AuthContext';
import { useScanTag } from '../hooks/useScanTag';

const Tab = createBottomTabNavigator();

const MainTabNavigator: React.FC = () => {
  const { userData } = useAuth();
  const isAdminOrOwner = userData?.role === 'admin' || userData?.role === 'owner';
  const { scan } = useScanTag();

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <MainTabBar {...props} onScanPress={scan} />}
    >
      <Tab.Screen name="dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="tools" component={ToolsScreen} options={{ tabBarLabel: 'Tools' }} />
      {isAdminOrOwner ? (
        <Tab.Screen name="sites" component={SitesScreen} options={{ tabBarLabel: 'Sites' }} />
      ) : (
        <Tab.Screen name="incidents" component={IncidentsScreen} options={{ tabBarLabel: 'Incidents' }} />
      )}
      <Tab.Screen name="settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
```

The scan logic is owned by `useScanTag` (created in Task 6). `MainTabNavigator` is now a plain composition of tabs + tab-bar wiring, no NFC knowledge.

Confirmed against `src/services/NFCService.ts` at plan time:
- Method: `public async readNFC(options?: NFCReadOptions): Promise<NFCOperationResult>` (line 337)
- Success payload: `{ success: true, data: { tagId: string, isEmpty?: boolean, ... } }`
- Failure: `{ success: false, error?: string }` or thrown Error
- Cancel: thrown Error with `.message` containing `"cancelled"` (see withRetry at line 319)

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep -E "MainTabNavigator" | head -10
```

Expected: no TS errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/MainTabNavigator.tsx
git commit -m "feat(nav): add MainTabNavigator with role-gated tabs and Scan FAB handler"
```

---

## Task 12: Cutover — swap `TabNavigation` → `MainTabNavigator` in `src/navigation/index.tsx`

**Files:**
- Modify: `src/navigation/index.tsx`

This is the single commit that flips the user-visible nav. Revertable in isolation.

- [ ] **Step 1: Swap the import**

In `src/navigation/index.tsx`, find this line:

```tsx
import TabNavigation from './TabNavigation';
```

Replace with:

```tsx
import MainTabNavigator from './MainTabNavigator';
```

- [ ] **Step 2: Replace the usage**

Find the `Stack.Screen` that registers `MainTabs` (inside `MainStack`):

```tsx
<Stack.Screen
  name="MainTabs"
  component={TabNavigation}
  options={{ headerShown: false }}
/>
```

Change `component={TabNavigation}` to `component={MainTabNavigator}`:

```tsx
<Stack.Screen
  name="MainTabs"
  component={MainTabNavigator}
  options={{ headerShown: false }}
/>
```

- [ ] **Step 3: Type check + test suite**

```bash
npx tsc --noEmit 2>&1 | grep -E "navigation/index" | head -10
npm test 2>&1 | tail -20
```

Expected: no TS errors for `navigation/index.tsx`. Test baseline unchanged (same pass/fail counts as before the branch).

- [ ] **Step 4: Commit**

```bash
git add src/navigation/index.tsx
git commit -m "feat(nav): cut over from TabNavigation to MainTabNavigator"
```

---

## Task 13: Retire dead code — delete old `TabNavigation.js` and `HomeScreen/`

**Files:**
- Delete: `src/navigation/TabNavigation.js`
- Delete: `src/screens/HomeScreen/` (entire directory — 4 files + `__tests__/`)

- [ ] **Step 1: Confirm nothing still imports them**

Run:
```bash
grep -rn "from.*navigation/TabNavigation\|from.*HomeScreen/HomeScreen\|from.*HomeScreen'\|from.*HomeScreen/hooks\|from.*HomeScreen/components" src 2>&1 | grep -v "src/screens/HomeScreen" | head -10
```

Expected: zero matches (the `grep -v` excludes intra-HomeScreen references that are being deleted together).

If any external match turns up — particularly for `HomeScreen/hooks/useDevices` or `HomeScreen/hooks/useLocations` which per `CLAUDE.md` still serve live callsites — STOP and report as `DONE_WITH_CONCERNS`. Options the controller may choose:
- Move the still-used hooks to `src/screens/Tools/hooks/` or a shared `src/hooks/` directory and update importers; then delete HomeScreen.
- Keep the hooks in place and only delete `HomeScreen.tsx` + `HomeScreen/components/` + `HomeScreen/index.ts` + `HomeScreen/__tests__/`, leaving `hooks/` alive.

Do NOT silently leave the old hooks orphaned — either move them or keep them.

- [ ] **Step 2: Delete the files**

```bash
git rm src/navigation/TabNavigation.js
git rm -r src/screens/HomeScreen/
```

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -20
```

Expected: same pass/fail counts as Task 12's step 3. Nothing regressed.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(nav): remove retired TabNavigation and HomeScreen (superseded by MainTabNavigator)"
```

---

## Task 14: Final verification

**Files:** none. Run-only.

Run on a physical device for the NFC-related checks; simulator is fine for the rest.

- [ ] **Step 1: Run the full Jest suite**

```bash
npm test 2>&1 | tail -30
```

Expected: baseline preserved. The newly-added tests contribute:
- 7 from `mainTabs.test.ts`
- 3 from `MainTabBar.test.tsx`
- 6 from `Dashboard/__tests__/quickActions.test.ts`
- 2 from `Dashboard/__tests__/DashboardScreen.test.tsx`
- 5 from `Settings/__tests__/sections.test.ts`

Total new passing tests: **23**. No new failures.

- [ ] **Step 2: Build a development client (optional but recommended)**

```bash
eas build --platform ios --profile development
# or
eas build --platform android --profile development
```

- [ ] **Step 3: On-device / simulator acceptance checklist**

Log in as each of the 4 roles in turn (owner, admin, office_worker, site_worker) and verify:

- [ ] Worker sees tabs `Dashboard | Tools | Scan | Incidents | Settings`
- [ ] Admin/Owner sees tabs `Dashboard | Tools | Scan | Sites | Settings`
- [ ] Center Scan FAB is visually elevated and yellow with dark icon
- [ ] Tapping Scan FAB starts NFC reader on a real device
- [ ] Successful NFC scan routes to `QuickActionModal`
- [ ] Cancelling the NFC reader dismisses silently with no alert
- [ ] Dashboard renders 4 Quick Actions for workers; 8 for admin/owner
- [ ] Dashboard "Overview" block renders (stubbed — shows loading state)
- [ ] Tools tab renders with empty state message "No tools yet. Tap Scan to check a tag."
- [ ] Admin/Owner sees "My Tools / All Org Tools" toggle on Tools tab; workers don't
- [ ] Sites tab (admin) displays existing locations correctly
- [ ] Incidents tab (worker) displays existing reports correctly
- [ ] Settings → worker sees: Account, Preferences, Support, Logout
- [ ] Settings → admin sees: Account, Preferences, Organization, Billing, Support, Logout
- [ ] Settings → Theme picker row renders as segmented control and changes theme
- [ ] Settings → Logout row prompts confirmation then logs out
- [ ] Universal link (`https://webportal.battwrapz.com/d/fake-uid`) opens the app and lands on `QuickActionModal`
- [ ] Deep link `tooltraq://d/fake-uid` also opens `QuickActionModal`
- [ ] Light mode and dark mode both render the new tab bar + FAB correctly
- [ ] No crashes when QuickActionModal loads (legacy shim handles missing `deviceService`)

- [ ] **Step 4: If any check fails** — commit a fix on the branch before opening the PR. Do not amend prior commits.

---

## Task 15: Push branch + open PR

**Files:** none. GitHub action.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/tooltraq-phase2a-nav 2>&1 | tail -5
```

- [ ] **Step 2: Open PR using `gh`**

```bash
gh pr create --title "TOOLTRAQ Phase 2a — nav restructure + role-based tabs (+ Phase 1 linking regression fix)" --body "$(cat <<'EOF'
## Summary

Phase 2a of the TOOLTRAQ redesign. Replaces the 5-tab bottom nav with a role-adaptive 2-FAB-2 layout featuring an elevated center **Scan** FAB.

- **Workers** (`site_worker`, `office_worker`): \`Dashboard | Tools | Scan | Incidents | Settings\`
- **Admins / Owners**: \`Dashboard | Tools | Scan | Sites | Settings\`

Also restores the Phase 1 universal-link regression (QuickActionModal + linking config missing in tracked master).

## Out of scope (Phase 2b — separate spec later)

- Dashboard polish to match mockup Image #2 (stat-card visuals, recent-activity feed)
- "History" tab as a real distinct screen (workers see Incidents in its slot for now)
- Vehicle/toolbox site-type UI differentiation
- Wiring Tools/Sites/Incidents to \`api.tooltraq.com/api/v1/\` endpoints (tracks API migration Phases 4–6)

## Notes

- \`QuickActionModalScreen\` was broken on master (relied on \`deviceService\` removed from AuthContext compat shim). Phase 2a adds \`legacyDeviceShim.ts\` so it doesn't crash; full revival lands when API v1 Phase 4/5 ship.
- \`TabNavigation.js\` and \`src/screens/HomeScreen/\` retired. All new tab screens live in \`src/screens/<TabName>/\` with their own \`components/\`, \`hooks/\`, and \`__tests__/\`.
- New terminology (Tools, Sites, Incidents) adopted in tab labels; underlying screens (LocationsScreen, ReportsScreen) still use legacy internals until API v1 migration lands.

## Docs

- Spec: \`docs/superpowers/specs/2026-04-22-tooltraq-phase2a-nav-design.md\`
- Plan: \`docs/superpowers/plans/2026-04-22-tooltraq-phase2a-nav.md\`

## Test plan

- [ ] 23 new Jest tests pass; baseline unchanged
- [ ] Workers and admin/owner each see the correct tab set on a dev client
- [ ] Scan FAB invokes NFC reader, success routes to QuickActionModal
- [ ] Universal link \`https://webportal.battwrapz.com/d/<uid>\` + \`tooltraq://d/<uid>\` both open the app at QuickActionModal
- [ ] Theme picker in Settings switches System/Light/Dark correctly
- [ ] Logout confirmation prompt still works from Settings
- [ ] Light and dark modes both render correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

- [ ] **Step 3: Return the PR URL to the user.**

---

## Appendix — summary of commits produced by this plan

1. `fix(nav): restore universal link config and register QuickActionModal (Phase 1 regression)`
2. `feat(nav): add role-gated tab config (mainTabs.ts)`
3. `feat(nav): add MainTabBar custom bottom tab bar with Scan FAB`
4. `feat(nav): add legacyDeviceShim to keep QuickActionModal alive during API v1 migration`
5. `feat(dashboard): add Dashboard + useScanTag hook shared by FAB and Scan tile`
6. `feat(tools): add Tools tab shell with site-grouped list and admin toggle`
7. `feat(sites): add Sites tab wrapper re-exporting LocationsScreen`
8. `feat(incidents): add Incidents tab wrapper re-exporting ReportsScreen`
9. `feat(settings): add Settings tab with role-gated sections, rows, and theme picker`
10. `feat(nav): add MainTabNavigator with role-gated tabs and Scan FAB handler`
11. `feat(nav): cut over from TabNavigation to MainTabNavigator`
12. `chore(nav): remove retired TabNavigation and HomeScreen (superseded by MainTabNavigator)`
