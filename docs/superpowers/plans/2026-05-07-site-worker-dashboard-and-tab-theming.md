# Site-Worker Dashboard + Per-Tab Accent Theming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a site-worker dashboard ("Your actions") and a cross-cutting per-tab accent theming system in one cohesive change.

**Architecture:** A new `AccentContext` driven by `NavigationContainer.onStateChange` exposes the focused bottom tab's accent (`{ fg, bg, ink }`) via `useAccent()`. Existing themed components (`MainTabBar`, `SegmentedTabs`, `FilterChips`, `QuickActions`, `DashboardHeader`) consume the accent instead of hardcoded `palette.amber`. A new `ActionButton` component renders fixed semantic action colours (Return amber, Report orange, Request blue, Log muted) that stay constant regardless of accent. The site-worker dashboard composes header + 4 quick-action tiles + a `TodayLogCard` + a `NEEDS YOUR ACTION` list of `ActionRow`s built from active assignments + my incidents + an EOD synthetic row.

**Tech Stack:** React Native 0.81.5, Expo SDK 54, React Navigation v7, TypeScript `strict: false`, Jest + `@testing-library/react-native`, Ionicons, existing `palette.ts`.

**Spec:** `docs/superpowers/specs/2026-05-07-site-worker-dashboard-and-tab-theming-design.md`

**Branch:** continue on `feature/office-worker-dashboard` (the prior cycle's worktree at `.worktrees/office-worker-dashboard`). The site-worker dashboard's office-worker counterpart already lives there; theming changes affect both.

**API note (verified during planning):**
- `GET /api/v1/assignments/mine/active/` returns a non-paginated array; each item has `expected_return_at?: string | null` (ISO YYYY-MM-DD).
- `GET /api/v1/assignments/mine/?status=returned` is paginated; filter `returned_at === todayISO` client-side for "RETURNED today" count.
- `GET /api/v1/incidents/mine/` lists my incidents (paged).
- `GET /api/v1/sites/?site_type=vehicle` returns vans-as-sites.
- `GET /api/v1/site-assignments/?user=<me>` returns my site-role placements (with `start_date`/`end_date`).
- `expected_return_at` is NOT yet in `src/api/generated/schema.ts` — Task 3 extends the manually-exported type without regenerating the whole schema.

---

## Task 1: Worktree status check

**Files:** none.

- [ ] **Step 1: Verify worktree state**

```bash
cd /home/garan/Documents/programming/live-projects/wrapbattz2/app/wrapbattz/.worktrees/office-worker-dashboard
git status --short
git log -1 --format="%h %s"
git branch --show-current
```

Expected: branch is `feature/office-worker-dashboard`, working tree clean, last commit is `9723e8a docs(spec): site-worker dashboard + per-tab accent theming` or later. **All subsequent tasks run from this worktree directory.**

- [ ] **Step 2: No commit** — proceed to Task 2.

---

## Task 2: Palette — three soft accent tokens

**Files:**
- Modify: `src/screens/Dashboard/shared/palette.ts`

Add `blueSoft`, `orangeSoft`, `violetSoft` adjacent to their solid counterparts. These are used by the per-tab accent map.

- [ ] **Step 1: Edit palette.ts**

Open `src/screens/Dashboard/shared/palette.ts`. The file currently has lines like `green: '#22C55E', greenSoft: 'rgba(34, 197, 94, 0.14)'`. Add three new soft tokens to the `palette` export, placed adjacent to their solid counterparts. The result should look like:

```ts
export const palette = {
  background: '#0E1117',
  card: '#161B22',
  cardBorder: 'rgba(255, 255, 255, 0.06)',
  divider: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: '#C9D1D9',
  textMuted: '#8B949E',
  textFaint: '#6E7681',
  amber: '#FFC72C',
  amberSoft: 'rgba(255, 199, 44, 0.12)',
  red: '#F85149',
  redSoft: 'rgba(248, 81, 73, 0.14)',
  orange: '#F97316',
  orangeSoft: 'rgba(249, 115, 22, 0.14)',
  green: '#22C55E',
  greenSoft: 'rgba(34, 197, 94, 0.14)',
  blue: '#58A6FF',
  blueSoft: 'rgba(88, 166, 255, 0.14)',
  violet: '#A78BFA',
  violetSoft: 'rgba(167, 139, 250, 0.14)',
  pink: '#EC4899',
  teal: '#14B8A6',
  placeholder: '#3E444C',
};

export const PLACEHOLDER_DASH = '—';
```

- [ ] **Step 2: Run all dashboard tests to confirm nothing breaks**

```bash
npm test -- src/screens/Dashboard
```

Expected: all currently-passing tests still pass (no behavioural change from palette addition).

- [ ] **Step 3: Commit**

```bash
git add src/screens/Dashboard/shared/palette.ts
git commit -m "feat(theme): add blueSoft, orangeSoft, violetSoft palette tokens"
```

---

## Task 3: Extend AssignmentRead type with `expected_return_at`

**Files:**
- Modify: `src/api/types.ts`

The new field isn't in the regenerated openapi schema yet. Manually intersect it onto the exported type so the rest of the codebase uses the correct shape.

- [ ] **Step 1: Edit types.ts**

Open `src/api/types.ts`. Locate the line `export type AssignmentRead = S['AssignmentRead'];`. Replace it with:

```ts
export type AssignmentRead = S['AssignmentRead'] & {
  /**
   * BACKEND_GAP: present in /api/v1/assignments/mine/active/ responses but not yet
   * in the generated openapi schema. Inline-extend until the schema regenerates.
   */
  expected_return_at?: string | null;
};
```

Keep every other type export unchanged.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "AssignmentRead|expected_return_at" | head -20
```

Expected: no errors mentioning `AssignmentRead` or `expected_return_at`. Pre-existing unrelated errors are fine.

- [ ] **Step 3: Run dashboard tests to confirm no regressions**

```bash
npm test -- src/screens/Dashboard src/screens/LocationDetail src/screens/TeamMemberDetail src/screens/TeamRoster
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/api/types.ts
git commit -m "feat(api): extend AssignmentRead with expected_return_at field"
```

---

## Task 4: Per-tab accent map + types

**Files:**
- Create: `src/theme/tabAccents.ts`
- Test: `src/theme/__tests__/tabAccents.test.ts`

The map is the single source of truth for which colour each bottom tab uses.

- [ ] **Step 1: Write failing test**

Create `src/theme/__tests__/tabAccents.test.ts`:

```ts
import { tabAccents, isTabAccentKey, TabAccentKey } from '../tabAccents';

describe('tabAccents', () => {
  const keys: TabAccentKey[] = ['dashboard', 'tools', 'incidents', 'sites', 'settings'];

  it('defines an accent for every supported tab key', () => {
    for (const key of keys) {
      expect(tabAccents[key]).toBeDefined();
      expect(tabAccents[key].fg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(tabAccents[key].bg).toMatch(/^rgba\(/);
      expect(tabAccents[key].ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('maps Dashboard to amber', () => {
    expect(tabAccents.dashboard.fg).toBe('#FFC72C');
  });

  it('maps Tools to blue', () => {
    expect(tabAccents.tools.fg).toBe('#58A6FF');
  });

  it('maps Incidents to orange', () => {
    expect(tabAccents.incidents.fg).toBe('#F97316');
  });

  it('maps Sites to green', () => {
    expect(tabAccents.sites.fg).toBe('#22C55E');
  });

  it('maps Settings to violet', () => {
    expect(tabAccents.settings.fg).toBe('#A78BFA');
  });

  it('isTabAccentKey returns true for known keys', () => {
    for (const key of keys) {
      expect(isTabAccentKey(key)).toBe(true);
    }
  });

  it('isTabAccentKey returns false for unknown keys', () => {
    expect(isTabAccentKey('scan')).toBe(false);
    expect(isTabAccentKey('foo')).toBe(false);
    expect(isTabAccentKey(null as any)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- src/theme/__tests__/tabAccents.test.ts
```

Expected: FAIL with "Cannot find module '../tabAccents'".

- [ ] **Step 3: Implement**

Create `src/theme/tabAccents.ts`:

```ts
import { palette } from '../screens/Dashboard/shared/palette';

export type TabAccentKey = 'dashboard' | 'tools' | 'incidents' | 'sites' | 'settings';

export interface TabAccent {
  key: TabAccentKey;
  fg: string;
  bg: string;
  ink: string;
}

const AMBER_INK = '#1B1300';
const BLUE_INK = '#001229';
const ORANGE_INK = '#26120B';
const GREEN_INK = '#0B240F';
const VIOLET_INK = '#150E2A';

export const tabAccents: Record<TabAccentKey, TabAccent> = {
  dashboard: { key: 'dashboard', fg: palette.amber,  bg: palette.amberSoft,  ink: AMBER_INK  },
  tools:     { key: 'tools',     fg: palette.blue,   bg: palette.blueSoft,   ink: BLUE_INK   },
  incidents: { key: 'incidents', fg: palette.orange, bg: palette.orangeSoft, ink: ORANGE_INK },
  sites:     { key: 'sites',     fg: palette.green,  bg: palette.greenSoft,  ink: GREEN_INK  },
  settings:  { key: 'settings',  fg: palette.violet, bg: palette.violetSoft, ink: VIOLET_INK },
};

const KNOWN_KEYS = new Set<string>(Object.keys(tabAccents));

export function isTabAccentKey(value: unknown): value is TabAccentKey {
  return typeof value === 'string' && KNOWN_KEYS.has(value);
}
```

- [ ] **Step 4: Run, verify PASS (8 tests)**

```bash
npm test -- src/theme/__tests__/tabAccents.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/theme/tabAccents.ts src/theme/__tests__/tabAccents.test.ts
git commit -m "feat(theme): add per-tab accent map (5 tabs)"
```

---

## Task 5: AccentContext + useAccent hook

**Files:**
- Create: `src/theme/AccentContext.tsx`
- Test: `src/theme/__tests__/AccentContext.test.tsx`

`AccentProvider` holds the current `TabAccent` in state; `useAccent()` reads it. A separate `useAccentSetter()` hook exposes the setter so the navigation container can call it from `onStateChange`. Default value is the Dashboard accent (amber) — used before navigation is ready.

- [ ] **Step 1: Write failing test**

Create `src/theme/__tests__/AccentContext.test.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import { AccentProvider, useAccent, useAccentSetter } from '../AccentContext';
import { tabAccents } from '../tabAccents';

const Probe: React.FC = () => {
  const accent = useAccent();
  return <Text>{accent.key}:{accent.fg}</Text>;
};

const Setter: React.FC<{ to: keyof typeof tabAccents }> = ({ to }) => {
  const set = useAccentSetter();
  React.useEffect(() => {
    set(tabAccents[to]);
  }, [set, to]);
  return null;
};

describe('AccentContext', () => {
  it('provides the dashboard accent by default', () => {
    render(<AccentProvider><Probe /></AccentProvider>);
    expect(screen.getByText('dashboard:#FFC72C')).toBeTruthy();
  });

  it('useAccent returns the dashboard accent when used outside a provider', () => {
    render(<Probe />);
    expect(screen.getByText('dashboard:#FFC72C')).toBeTruthy();
  });

  it('updates accent when the setter is called', () => {
    render(
      <AccentProvider>
        <Setter to="tools" />
        <Probe />
      </AccentProvider>
    );
    expect(screen.getByText('tools:#58A6FF')).toBeTruthy();
  });

  it('useAccentSetter is a no-op outside a provider (does not throw)', () => {
    expect(() =>
      render(<Setter to="tools" />)
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- src/theme/__tests__/AccentContext.test.tsx
```

Expected: FAIL with "Cannot find module '../AccentContext'".

- [ ] **Step 3: Implement**

Create `src/theme/AccentContext.tsx`:

```tsx
import React, { createContext, useCallback, useContext, useState } from 'react';
import { tabAccents, TabAccent } from './tabAccents';

const DEFAULT_ACCENT = tabAccents.dashboard;
const NOOP_SETTER: (a: TabAccent) => void = () => {};

const AccentValueContext = createContext<TabAccent>(DEFAULT_ACCENT);
const AccentSetterContext = createContext<(a: TabAccent) => void>(NOOP_SETTER);

export function useAccent(): TabAccent {
  return useContext(AccentValueContext);
}

export function useAccentSetter(): (a: TabAccent) => void {
  return useContext(AccentSetterContext);
}

interface ProviderProps {
  children: React.ReactNode;
}

export const AccentProvider: React.FC<ProviderProps> = ({ children }) => {
  const [accent, setAccent] = useState<TabAccent>(DEFAULT_ACCENT);
  const stableSetter = useCallback((next: TabAccent) => setAccent(next), []);
  return (
    <AccentSetterContext.Provider value={stableSetter}>
      <AccentValueContext.Provider value={accent}>
        {children}
      </AccentValueContext.Provider>
    </AccentSetterContext.Provider>
  );
};
```

- [ ] **Step 4: Run, verify PASS (4 tests)**

```bash
npm test -- src/theme/__tests__/AccentContext.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/theme/AccentContext.tsx src/theme/__tests__/AccentContext.test.tsx
git commit -m "feat(theme): add AccentContext + useAccent/useAccentSetter hooks"
```

---

## Task 6: Wire AccentProvider into App.js + onStateChange in AppNavigator

**Files:**
- Modify: `App.js`
- Modify: `src/navigation/index.tsx`

Wrap the AppNavigator in `AccentProvider`, and inside the navigator subscribe to `NavigationContainer.onStateChange` to walk to the focused bottom tab and call `setAccent`.

- [ ] **Step 1: Edit App.js — wrap AppNavigator with AccentProvider**

Open `App.js`. After the existing import block at the top (above the line `import { AppNavigator } from './src/navigation/index';`), add:

```js
import { AccentProvider } from './src/theme/AccentContext';
```

Then in the JSX, change:

```jsx
<ThemeProvider>
  <AppNavigator />
</ThemeProvider>
```

to:

```jsx
<ThemeProvider>
  <AccentProvider>
    <AppNavigator />
  </AccentProvider>
</ThemeProvider>
```

- [ ] **Step 2: Edit `src/navigation/index.tsx` — add onStateChange handler**

Add at the top (with other imports):

```tsx
import { useAccentSetter } from '../theme/AccentContext';
import { tabAccents, isTabAccentKey, TabAccentKey } from '../theme/tabAccents';
import type { NavigationState, PartialState } from '@react-navigation/native';
```

Below the `linking` constant, add a helper that walks the state tree to find the focused tab key:

```tsx
function findFocusedBottomTab(
  state: NavigationState | PartialState<NavigationState> | undefined,
): TabAccentKey | null {
  let current: any = state;
  while (current && Array.isArray(current.routes)) {
    const idx = typeof current.index === 'number' ? current.index : 0;
    const route = current.routes[idx];
    if (!route) return null;
    if (isTabAccentKey(route.name)) return route.name;
    current = route.state;
  }
  return null;
}
```

Now modify `AppNavigator` to call the setter on state changes. Replace the current body of `AppNavigator`:

```tsx
export const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer linking={linking}>
      {isAuthenticated ? <OnboardingStack /> : <AuthStack />}
    </NavigationContainer>
  );
};
```

with:

```tsx
export const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const setAccent = useAccentSetter();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      linking={linking}
      onStateChange={(state) => {
        const key = findFocusedBottomTab(state);
        if (key) setAccent(tabAccents[key]);
      }}
    >
      {isAuthenticated ? <OnboardingStack /> : <AuthStack />}
    </NavigationContainer>
  );
};
```

- [ ] **Step 3: Run dashboard tests to confirm no regression**

```bash
npm test -- src/screens/Dashboard
```

Expected: all currently-passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add App.js src/navigation/index.tsx
git commit -m "feat(theme): wire AccentProvider; sync accent from focused bottom tab"
```

---

## Task 7: Refactor MainTabBar to per-tab accent

**Files:**
- Modify: `src/navigation/MainTabBar.tsx`

The active tab's tint becomes its accent colour, not the global `colors.primary`. Inactive tabs stay muted.

- [ ] **Step 1: Edit MainTabBar.tsx**

Open `src/navigation/MainTabBar.tsx`. Add to the imports (with other imports):

```tsx
import { tabAccents, isTabAccentKey } from '../theme/tabAccents';
```

Locate `renderRegularTab`. The current implementation has:

```tsx
const tint = focused ? colors.primary : colors.textMuted;
```

Replace that single line with:

```tsx
const accent = isTabAccentKey(tab.key) ? tabAccents[tab.key] : undefined;
const tint = focused ? (accent?.fg ?? colors.primary) : colors.textMuted;
```

Locate `renderFab`. Its label currently reads `[styles.fabLabel, { color: colors.primary }]`. Leave it unchanged — the Scan tab is not a `TabAccentKey` (it's `'scan'`), and the spec says the FAB stays as the Q-button image with the existing amber label.

- [ ] **Step 2: Run navigation/dashboard tests**

```bash
npm test -- src/navigation src/screens/Dashboard
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/MainTabBar.tsx
git commit -m "feat(theme): MainTabBar uses per-tab accent for active tint"
```

---

## Task 8: Refactor SegmentedTabs + FilterChips to use accent

**Files:**
- Modify: `src/screens/Dashboard/OfficeWorker/components/SegmentedTabs.tsx`
- Modify: `src/screens/Dashboard/OfficeWorker/components/FilterChips.tsx`

Both currently hard-code `palette.amber` for the active state. Replace with `useAccent()`.

- [ ] **Step 1: Edit SegmentedTabs.tsx**

Open `src/screens/Dashboard/OfficeWorker/components/SegmentedTabs.tsx`. Add to imports:

```tsx
import { useAccent } from '../../../../theme/AccentContext';
```

The current `Tab` sub-component renders:

```tsx
<TouchableOpacity
  style={[styles.tab, active && styles.tabActive]}
  ...
>
  <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
</TouchableOpacity>
```

with `tabActive: { backgroundColor: palette.amber }` and `labelActive: { color: '#1B1300', fontWeight: '700' }`.

Change it so the parent `SegmentedTabs` passes the active styling colours derived from the current accent. Modify `SegmentedTabs` to read the accent and pass it down via inline style overrides on the active tab. The component body becomes:

```tsx
const SegmentedTabs: React.FC<Props> = ({ left, right, value, onChange }) => {
  const accent = useAccent();
  const activeBg = { backgroundColor: accent.fg };
  const activeInk = { color: accent.ink };
  return (
    <View style={styles.row} accessibilityRole="tablist">
      <Tab label={left}  active={value === 'left'}  activeBg={activeBg} activeInk={activeInk}
           onPress={() => value !== 'left'  && onChange('left')} />
      <Tab label={right} active={value === 'right'} activeBg={activeBg} activeInk={activeInk}
           onPress={() => value !== 'right' && onChange('right')} />
    </View>
  );
};
```

Change the `Tab` sub-component to accept and apply `activeBg` and `activeInk` style props:

```tsx
interface TabProps {
  label: string;
  active: boolean;
  activeBg: { backgroundColor: string };
  activeInk: { color: string };
  onPress: () => void;
}

const Tab: React.FC<TabProps> = ({ label, active, activeBg, activeInk, onPress }) => (
  <TouchableOpacity
    style={[styles.tab, active && activeBg]}
    onPress={onPress}
    accessibilityRole="tab"
    accessibilityLabel={`${label} tab`}
    accessibilityState={{ selected: active }}
    activeOpacity={0.85}
  >
    <Text style={[styles.label, active && [styles.labelActive, activeInk]]}>{label}</Text>
  </TouchableOpacity>
);
```

Remove `tabActive` from `styles`. Keep `labelActive: { fontWeight: '700' }` (the colour comes from `activeInk` now); drop the `color` field from `labelActive`.

The full updated styles block:
```tsx
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  tab: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  label: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '700',
  },
});
```

- [ ] **Step 2: Edit FilterChips.tsx**

Open `src/screens/Dashboard/OfficeWorker/components/FilterChips.tsx`. Add to imports:

```tsx
import { useAccent } from '../../../../theme/AccentContext';
```

The component currently hard-codes `palette.amberSoft` (active bg), `palette.amber` (active border + label). Read the accent and apply inline. In the function body:

```tsx
function FilterChips<K extends string>({ items, value, onChange }: Props<K>) {
  const accent = useAccent();
  const activeChipStyle = { backgroundColor: accent.bg, borderColor: accent.fg };
  const activeLabelStyle = { color: accent.fg };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.chip, active && activeChipStyle]}
            onPress={() => active || onChange(item.key)}
            accessibilityRole="radio"
            accessibilityLabel={`${item.label} filter`}
            accessibilityState={{ selected: active }}
            activeOpacity={0.85}
          >
            <Text style={[styles.label, active && [styles.labelActive, activeLabelStyle]]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
```

Remove `chipActive` from styles. Keep `labelActive: { fontWeight: '700' }` (colour comes from `activeLabelStyle`); drop the `color` field from `labelActive`.

Updated styles block:
```tsx
const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  labelActive: { fontWeight: '700' },
});
```

- [ ] **Step 3: Run affected tests**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/components/__tests__/ src/screens/LocationDetail
```

Expected: all pass. Existing tests assert on accessibility labels/state (not specific colours), so they continue to work.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Dashboard/OfficeWorker/components/SegmentedTabs.tsx src/screens/Dashboard/OfficeWorker/components/FilterChips.tsx
git commit -m "feat(theme): SegmentedTabs and FilterChips consume useAccent"
```

---

## Task 9: Refactor QuickActions (primaryActionKind + accent fallback) and DashboardHeader avatar

**Files:**
- Modify: `src/screens/Dashboard/shared/components/QuickActions.tsx`
- Modify: `src/screens/Dashboard/shared/components/DashboardHeader.tsx`

`QuickActions` gets a new optional `primaryActionKind` prop. When set, the primary tile renders with the fixed semantic colour for that action kind (used by site-worker dashboard's amber Return tile). When not set, the primary tile uses the active accent (used by office-worker, admin, owner dashboards). `DashboardHeader`'s avatar bg becomes `accent.fg`.

- [ ] **Step 1: Define ActionKind shared map**

Create a small shared module for the semantic action colour map. Create `src/screens/Dashboard/shared/actionColours.ts`:

```ts
import { palette } from './palette';

export type ActionKind = 'return' | 'report' | 'request' | 'log' | 'scan' | 'neutral';

interface ActionColour { fg: string; bg: string; ink: string; }

const NEUTRAL_INK = '#FFFFFF';
const RETURN_INK = '#1B1300';
const REPORT_INK = '#26120B';
const REQUEST_INK = '#001229';

export const actionColours: Record<ActionKind, ActionColour> = {
  return:  { fg: palette.amber,         bg: palette.amber,        ink: RETURN_INK  },
  report:  { fg: palette.orange,        bg: palette.orangeSoft,   ink: REPORT_INK  },
  request: { fg: palette.blue,          bg: palette.blueSoft,     ink: REQUEST_INK },
  log:     { fg: palette.textSecondary, bg: palette.card,         ink: NEUTRAL_INK },
  scan:    { fg: palette.amber,         bg: palette.amberSoft,    ink: RETURN_INK  },
  neutral: { fg: palette.textPrimary,   bg: palette.card,         ink: NEUTRAL_INK },
};
```

- [ ] **Step 2: Edit QuickActions.tsx**

Open `src/screens/Dashboard/shared/components/QuickActions.tsx`. Add imports:

```tsx
import { useAccent } from '../../../../theme/AccentContext';
import { actionColours, ActionKind } from '../actionColours';
```

The component currently has:

```tsx
export interface QuickActionItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  onPress: () => void;
}
```

Extend with an optional `actionKind`:

```tsx
export interface QuickActionItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  actionKind?: ActionKind;
  onPress: () => void;
}
```

In the render body, the primary tile currently uses `styles.tilePrimary` with `backgroundColor: palette.amber`. Replace the colour resolution: if `item.actionKind` is set use its colour, otherwise use the accent.

The current return:

```tsx
const QuickActions: React.FC<Props> = ({ items }) => {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.tile, item.primary ? styles.tilePrimary : styles.tileGhost]}
          onPress={item.onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Ionicons
            name={item.icon}
            size={22}
            color={item.primary ? '#1B1300' : palette.textPrimary}
          />
          <Text
            style={[
              styles.label,
              { color: item.primary ? '#1B1300' : palette.textPrimary },
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

Becomes:

```tsx
const QuickActions: React.FC<Props> = ({ items }) => {
  const accent = useAccent();
  return (
    <View style={styles.row}>
      {items.map((item) => {
        const isPrimary = !!item.primary;
        const primaryColours = isPrimary
          ? (item.actionKind ? actionColours[item.actionKind] : { fg: accent.fg, ink: accent.ink })
          : null;
        const backgroundColor = primaryColours ? primaryColours.fg : palette.card;
        const ink = primaryColours ? primaryColours.ink : palette.textPrimary;
        return (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.tile,
              isPrimary
                ? { backgroundColor }
                : styles.tileGhost,
            ]}
            onPress={item.onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <Ionicons name={item.icon} size={22} color={ink} />
            <Text style={[styles.label, { color: ink }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
```

Drop `styles.tilePrimary` from the StyleSheet (no longer used). The styles block becomes:

```tsx
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  tile: {
    flex: 1,
    height: 78,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tileGhost: {
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
});
```

- [ ] **Step 3: Edit DashboardHeader.tsx**

Open `src/screens/Dashboard/shared/components/DashboardHeader.tsx`. Add to imports:

```tsx
import { useAccent } from '../../../../theme/AccentContext';
```

In the component body, before the return:

```tsx
const accent = useAccent();
```

Find the avatar `<TouchableOpacity>` (it currently uses `styles.avatar` with `backgroundColor: palette.amber` and the avatar text uses `color: '#1B1300'`). Update its style and the inner text to use the accent:

```tsx
<TouchableOpacity
  style={[styles.avatar, { backgroundColor: accent.fg }]}
  onPress={onAvatarPress}
  accessibilityRole="button"
  accessibilityLabel="Open profile"
  activeOpacity={0.85}
>
  <Text style={[styles.avatarText, { color: accent.ink }]}>{initials}</Text>
</TouchableOpacity>
```

Drop `backgroundColor: palette.amber` from `styles.avatar` and `color: '#1B1300'` from `styles.avatarText` (now provided inline). Leave the rest of the styles block intact.

Updated styles fragments:
```tsx
avatar: {
  width: 38,
  height: 38,
  borderRadius: 19,
  alignItems: 'center',
  justifyContent: 'center',
},
avatarText: {
  fontWeight: '800',
  fontSize: 14,
  letterSpacing: 0.5,
},
```

- [ ] **Step 4: Run affected tests**

```bash
npm test -- src/screens/Dashboard
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/shared/actionColours.ts src/screens/Dashboard/shared/components/QuickActions.tsx src/screens/Dashboard/shared/components/DashboardHeader.tsx
git commit -m "feat(theme): QuickActions primaryActionKind + DashboardHeader avatar uses accent"
```

---

## Task 10: ActionButton component

**Files:**
- Create: `src/screens/Dashboard/shared/components/ActionButton.tsx`
- Test: `src/screens/Dashboard/shared/components/__tests__/ActionButton.test.tsx`

A reusable button that renders fixed semantic colours per `ActionKind`. Used by the site-worker dashboard for per-row CTAs and (later) anywhere actions appear inline.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/shared/components/__tests__/ActionButton.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ActionButton from '../ActionButton';

describe('ActionButton', () => {
  it('renders the label', () => {
    render(<ActionButton kind="return" label="Return" onPress={() => {}} />);
    expect(screen.getByText('Return')).toBeTruthy();
  });

  it('calls onPress', () => {
    const onPress = jest.fn();
    render(<ActionButton kind="return" label="Return" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Return'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has accessibility role button', () => {
    render(<ActionButton kind="report" label="Report" onPress={() => {}} />);
    expect(screen.getByLabelText('Report').props.accessibilityRole).toBe('button');
  });

  it('compact variant still calls onPress', () => {
    const onPress = jest.fn();
    render(<ActionButton kind="log" label="Log" variant="compact" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Log'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/ActionButton.test.tsx
```

Expected: FAIL with "Cannot find module '../ActionButton'".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/shared/components/ActionButton.tsx`:

```tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../palette';
import { actionColours, ActionKind } from '../actionColours';

interface Props {
  kind: ActionKind;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'compact';
  onPress: () => void;
}

const ActionButton: React.FC<Props> = ({ kind, label, icon, variant = 'compact', onPress }) => {
  const colours = actionColours[kind];
  const isPrimary = variant === 'primary';
  const baseStyle = isPrimary ? styles.primary : styles.compact;
  const bg = isPrimary ? colours.fg : colours.bg;
  const fg = isPrimary ? colours.ink : colours.fg;
  return (
    <TouchableOpacity
      style={[baseStyle, { backgroundColor: bg }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.85}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={isPrimary ? 22 : 14} color={fg} />
        </View>
      ) : null}
      <Text style={[isPrimary ? styles.primaryLabel : styles.compactLabel, { color: fg }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primary: {
    flex: 1,
    height: 78,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  iconWrap: { },
  primaryLabel: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  compactLabel: { fontSize: 13, fontWeight: '600' },
});

export default ActionButton;
```

- [ ] **Step 4: Run, verify PASS (4 tests)**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/ActionButton.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/shared/components/ActionButton.tsx src/screens/Dashboard/shared/components/__tests__/ActionButton.test.tsx
git commit -m "feat(dashboard): add ActionButton with semantic action colours"
```

---

## Task 11: Site-worker types + useSiteWorkerData hook

**Files:**
- Create: `src/screens/Dashboard/SiteWorker/types.ts`
- Create: `src/screens/Dashboard/SiteWorker/hooks/useSiteWorkerData.ts`
- Test: `src/screens/Dashboard/SiteWorker/hooks/__tests__/useSiteWorkerData.test.ts`

Loads my active assignments + my returned-today + my incidents + vans + my site-assignments + organisation; derives `checkedOut`, `returnedToday`, `overdueCount`, `siteTagline`, and the `rows` action list (overdue, due-today, flagged, EOD synthetic).

- [ ] **Step 1: Define types**

Create `src/screens/Dashboard/SiteWorker/types.ts`:

```ts
import type { Ionicons } from '@expo/vector-icons';
import type { ActionKind } from '../shared/actionColours';

export type ActionRowKind = 'overdue' | 'due_today' | 'flagged' | 'eod';

export interface ActionRow {
  id: string;
  kind: ActionRowKind;
  iconName: keyof typeof Ionicons.glyphMap;
  iconTint?: string;
  primary: string;
  secondary: string;
  cta: { kind: ActionKind; label: string };
  payload: { assignmentId?: number; incidentId?: number; toolId?: number; vanId?: number };
}

export interface SiteWorkerData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;

  organizationName: string;
  siteTagline: string;
  userInitials: string;
  hasUnreadAlerts: boolean | null;

  checkedOut: number;
  returnedToday: number;
  overdueCount: number;

  rows: ActionRow[];
}
```

- [ ] **Step 2: Write failing hook test**

Create `src/screens/Dashboard/SiteWorker/hooks/__tests__/useSiteWorkerData.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSiteWorkerData } from '../useSiteWorkerData';

const mockListMyActive = jest.fn();
const mockListMine = jest.fn();
const mockListMyIncidents = jest.fn();
const mockListSites = jest.fn();
const mockListSiteAssignments = jest.fn();
const mockGetMyOrg = jest.fn();

jest.mock('../../../../../api/endpoints', () => ({
  assignments: {
    listMyActiveAssignments: (...args: any[]) => mockListMyActive(...args),
    listMyAssignments: (...args: any[]) => mockListMine(...args),
  },
  incidents: { listMyIncidents: (...args: any[]) => mockListMyIncidents(...args) },
  sites: { listSites: (...args: any[]) => mockListSites(...args) },
  siteAssignments: { listSiteAssignments: (...args: any[]) => mockListSiteAssignments(...args) },
  organizations: { getMyOrganization: (...args: any[]) => mockGetMyOrg(...args) },
}));

jest.mock('../../../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { id: 200, first_name: 'Wendy', last_name: 'Jones', email: 'wj@x.com' } }),
}));

const TODAY_ISO = new Date().toISOString().slice(0, 10);

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockGetMyOrg.mockResolvedValue({ name: 'Davidson-Morris' });
  mockListSites.mockResolvedValue({
    items: [{ id: 5, name: 'Transit Van 02', site_type: 'vehicle', prefix_code: 'VAN-02', status: 'active' }],
    total: 1, page: 1, page_size: 50, total_pages: 1,
  });
  mockListSiteAssignments.mockResolvedValue({
    items: [{ id: 1, user_id: 200, user_email: 'wj@x.com', site_id: 9, site_name: 'Chelsea Wharf', role: 'Site lead', is_active: true, created_at: '' }],
    total: 1, page: 1, page_size: 50, total_pages: 1,
  });
  mockListMyIncidents.mockResolvedValue({
    items: [
      { id: 11, tool_id: 100, tool_name: 'Milwaukee SE-8330', type: 'check', severity: 'medium', status: 'open', description: 'Blade check flagged', created_at: '' },
    ],
    total: 1, page: 1, page_size: 50, total_pages: 1,
  });
  mockListMine.mockResolvedValue({
    items: [
      { id: 50, tool_id: 70, tool_name: 'Returned Drill', status: 'returned', returned_at: TODAY_ISO },
      { id: 51, tool_id: 71, tool_name: 'Older Returned',  status: 'returned', returned_at: isoDaysAgo(2) },
    ],
    total: 2, page: 1, page_size: 50, total_pages: 1,
  });
  mockListMyActive.mockResolvedValue([
    {
      id: 1, tool_id: 200, tool_name: 'Bosch GH-3544', status: 'active',
      assigned_at: isoDaysAgo(11), expected_return_at: isoDaysAgo(4), returned_at: null, assignee_user_id: 200,
    },
    {
      id: 2, tool_id: 201, tool_name: 'Honda EU22i', status: 'active',
      assigned_at: isoDaysAgo(2), expected_return_at: TODAY_ISO, returned_at: null, assignee_user_id: 200,
    },
    {
      id: 3, tool_id: 202, tool_name: 'Generic Drill', status: 'active',
      assigned_at: TODAY_ISO, expected_return_at: null, returned_at: null, assignee_user_id: 200,
    },
    {
      id: 4, tool_id: 203, tool_name: 'Milwaukee SE-8330', status: 'active',
      assigned_at: isoDaysAgo(1), expected_return_at: null, returned_at: null, assignee_user_id: 200,
    },
    {
      id: 5, tool_id: 204, tool_name: 'Van Tool A', status: 'active',
      assigned_at: TODAY_ISO, expected_return_at: null, returned_at: null,
      assignee_site_id: 5, assignee_site_name: 'Transit Van 02',
    },
    {
      id: 6, tool_id: 205, tool_name: 'Van Tool B', status: 'active',
      assigned_at: TODAY_ISO, expected_return_at: null, returned_at: null,
      assignee_site_id: 5, assignee_site_name: 'Transit Van 02',
    },
  ]);
});

describe('useSiteWorkerData', () => {
  it('returns CHECKED OUT count from active assignments length', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.checkedOut).toBe(6);
  });

  it('counts only assignments returned today as RETURNED', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.returnedToday).toBe(1);
  });

  it('counts overdue assignments (expected_return_at < today)', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overdueCount).toBe(1);
  });

  it('produces an overdue row before a due-today row', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const overdueIdx = result.current.rows.findIndex(r => r.kind === 'overdue');
    const dueIdx = result.current.rows.findIndex(r => r.kind === 'due_today');
    expect(overdueIdx).toBeGreaterThanOrEqual(0);
    expect(dueIdx).toBeGreaterThan(overdueIdx);
  });

  it('produces a flagged row from listMyIncidents', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const flagged = result.current.rows.find(r => r.kind === 'flagged');
    expect(flagged?.primary).toBe('Milwaukee SE-8330');
    expect(flagged?.cta.kind).toBe('log');
  });

  it('builds tagline from active site assignment', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.siteTagline).toContain('CHELSEA WHARF');
  });

  it('falls back to ORG / SITE tagline when no active site assignment', async () => {
    mockListSiteAssignments.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.siteTagline).toContain('SITE');
  });

  it('emits an EOD row at 16:00 with van-assigned tools', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(`${TODAY_ISO}T16:30:00Z`));
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const eod = result.current.rows.find(r => r.kind === 'eod');
    expect(eod).toBeDefined();
    expect(eod?.secondary).toMatch(/2 items.*VAN-02/);
  });

  it('does NOT emit an EOD row before 16:00', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(`${TODAY_ISO}T09:00:00Z`));
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows.find(r => r.kind === 'eod')).toBeUndefined();
  });

  it('captures error from listMyActiveAssignments', async () => {
    mockListMyActive.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('boom');
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

```bash
npm test -- src/screens/Dashboard/SiteWorker/hooks/__tests__/useSiteWorkerData.test.ts
```

Expected: FAIL "Cannot find module '../useSiteWorkerData'".

- [ ] **Step 4: Implement**

Create `src/screens/Dashboard/SiteWorker/hooks/useSiteWorkerData.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignments as assignmentsApi,
  incidents as incidentsApi,
  sites as sitesApi,
  siteAssignments as siteAssignmentsApi,
  organizations as organizationsApi,
} from '../../../../api/endpoints';
import type {
  AssignmentRead,
  IncidentRead,
  OrganizationRead,
  SiteAssignmentRead,
  SiteRead,
} from '../../../../api/types';
import { useAuth } from '../../../../context/AuthContext';
import { computeInitials } from '../../shared/identity';
import type { ActionRow, SiteWorkerData } from '../types';

const EOD_HOUR = 16;
const LOCATION_PAGE_SIZE = 200;

interface RawData {
  org: OrganizationRead | null;
  active: AssignmentRead[];
  returnedPage: { items: AssignmentRead[] };
  incidents: IncidentRead[];
  vehicleSites: SiteRead[];
  mySiteAssignments: SiteAssignmentRead[];
}

const EMPTY: RawData = {
  org: null, active: [], returnedPage: { items: [] }, incidents: [], vehicleSites: [], mySiteAssignments: [],
};

const CLOSED_STATUSES = new Set(['resolved', 'closed', 'cancelled', 'RESOLVED', 'CLOSED', 'CANCELLED']);

export function useSiteWorkerData(): SiteWorkerData {
  const { userData } = useAuth();
  const myUserId = userData?.id;
  const [raw, setRaw] = useState<RawData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      // BACKEND_GAP: org-local "today" — comparing UTC ISO date strings.
      // Replace with org-tz-aware comparison once the server agrees a timezone contract.
      const [org, active, returnedPage, incidentsPage, sitesPage, mySaPage] = await Promise.all([
        organizationsApi.getMyOrganization().catch(() => null),
        assignmentsApi.listMyActiveAssignments(),
        assignmentsApi.listMyAssignments('returned'),
        incidentsApi.listMyIncidents(),
        sitesApi.listSites({ site_type: 'vehicle', page_size: LOCATION_PAGE_SIZE }),
        myUserId
          ? siteAssignmentsApi.listSiteAssignments({ user: myUserId })
          : Promise.resolve({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 }),
      ]);
      setRaw({
        org,
        active,
        returnedPage: { items: returnedPage.items },
        incidents: incidentsPage.items,
        vehicleSites: sitesPage.items,
        mySiteAssignments: mySaPage.items,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      setIsLoading(false);
    }
  }, [myUserId]);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<SiteWorkerData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const todayIso = new Date().toISOString().slice(0, 10);

    const overdue = raw.active.filter((a) =>
      a.expected_return_at && a.expected_return_at < todayIso && !a.returned_at
    );
    const dueToday = raw.active.filter((a) =>
      a.expected_return_at === todayIso && !a.returned_at
    );

    const returnedToday = raw.returnedPage.items.filter((a) =>
      a.returned_at === todayIso
    ).length;

    const flaggedIncidents = raw.incidents.filter((i) => !CLOSED_STATUSES.has(i.status));

    const vanSiteIds = new Set(raw.vehicleSites.map((v) => v.id));
    const vanAssignments = raw.active.filter((a) =>
      a.assignee_site_id != null && vanSiteIds.has(a.assignee_site_id)
    );

    const rows: ActionRow[] = [];

    for (const a of overdue.sort((x, y) => (x.expected_return_at ?? '').localeCompare(y.expected_return_at ?? ''))) {
      const days = a.expected_return_at ? daysBetween(a.expected_return_at, todayIso) : 0;
      rows.push({
        id: `overdue-${a.id}`,
        kind: 'overdue',
        iconName: 'time-outline',
        iconTint: '#F85149', // red
        primary: a.tool_name || `Tool #${a.tool_id}`,
        secondary: `Return overdue · ${days} ${days === 1 ? 'day' : 'days'}`,
        cta: { kind: 'return', label: 'Return' },
        payload: { assignmentId: a.id, toolId: a.tool_id },
      });
    }

    for (const a of dueToday) {
      rows.push({
        id: `due-${a.id}`,
        kind: 'due_today',
        iconName: 'time-outline',
        primary: a.tool_name || `Tool #${a.tool_id}`,
        secondary: 'Return due today',
        cta: { kind: 'return', label: 'Return' },
        payload: { assignmentId: a.id, toolId: a.tool_id },
      });
    }

    for (const i of flaggedIncidents) {
      rows.push({
        id: `flagged-${i.id}`,
        kind: 'flagged',
        iconName: 'construct-outline',
        primary: i.tool_name || `Tool #${i.tool_id}`,
        secondary: truncate(i.description) || `${i.type} flagged`,
        cta: { kind: 'log', label: 'Log' },
        payload: { incidentId: i.id, toolId: i.tool_id },
      });
    }

    const now = new Date();
    // BACKEND_GAP: org-tz-aware comparison not yet defined; use UTC per project default.
    if (now.getUTCHours() >= EOD_HOUR && vanAssignments.length > 0) {
      const firstVanId = vanAssignments[0].assignee_site_id ?? null;
      const van = firstVanId != null
        ? raw.vehicleSites.find((v) => v.id === firstVanId)
        : undefined;
      const vanLabel = van?.prefix_code || van?.name || 'your van';
      rows.push({
        id: 'eod-return',
        kind: 'eod',
        iconName: 'scan-outline',
        primary: 'End-of-day return',
        secondary: `Scan ${vanAssignments.length} item${vanAssignments.length === 1 ? '' : 's'} back to ${vanLabel}`,
        cta: { kind: 'scan', label: 'Scan' },
        payload: { vanId: firstVanId ?? undefined },
      });
    }

    const orgName = (raw.org?.name ?? userData?.organization?.name ?? '').toUpperCase();
    const activeSa = raw.mySiteAssignments.find((s) => s.is_active);
    // BACKEND_GAP: SiteAssignmentRead has site_name but no prefix_code, so we cannot
    // render the prefixed tagline (e.g. "CHW-04 / CHELSEA WHARF") without a second
    // sites.getSite() lookup. Render the upper-cased site_name only for v1.
    const siteTagline = activeSa
      ? (activeSa.site_name ?? '').toUpperCase()
      : `${orgName || 'YOUR ORGANIZATION'} / SITE`;

    return {
      organizationName: orgName,
      siteTagline,
      userInitials: computeInitials(userData?.first_name, userData?.last_name, userData?.email),
      hasUnreadAlerts: null,
      checkedOut: raw.active.length,
      returnedToday,
      overdueCount: overdue.length,
      rows,
    };
  }, [raw, userData]);

  return { ...data, isLoading, error, refresh: load };
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function truncate(s: string | undefined | null, max = 36): string {
  if (!s) return '';
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
```

- [ ] **Step 5: Run, verify PASS (10 tests)**

```bash
npm test -- src/screens/Dashboard/SiteWorker/hooks/__tests__/useSiteWorkerData.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/Dashboard/SiteWorker/types.ts src/screens/Dashboard/SiteWorker/hooks/useSiteWorkerData.ts src/screens/Dashboard/SiteWorker/hooks/__tests__/useSiteWorkerData.test.ts
git commit -m "feat(dashboard): add site-worker data hook with overdue/due/flagged/EOD rows"
```

---

## Task 12: TodayLogCard component

**Files:**
- Create: `src/screens/Dashboard/SiteWorker/components/TodayLogCard.tsx`
- Test: `src/screens/Dashboard/SiteWorker/components/__tests__/TodayLogCard.test.tsx`

3-cell stat card showing CHECKED OUT, RETURNED, OVERDUE.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/SiteWorker/components/__tests__/TodayLogCard.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import TodayLogCard from '../TodayLogCard';

describe('TodayLogCard', () => {
  it('renders three stat cells', () => {
    render(<TodayLogCard checkedOut={4} returnedToday={0} overdueCount={1} />);
    expect(screen.getByText('CHECKED OUT')).toBeTruthy();
    expect(screen.getByText('RETURNED')).toBeTruthy();
    expect(screen.getByText('OVERDUE')).toBeTruthy();
  });

  it('renders the numeric values', () => {
    render(<TodayLogCard checkedOut={4} returnedToday={2} overdueCount={1} />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders the TODAY’S LOG heading', () => {
    render(<TodayLogCard checkedOut={0} returnedToday={0} overdueCount={0} />);
    expect(screen.getByText("TODAY'S LOG")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- src/screens/Dashboard/SiteWorker/components/__tests__/TodayLogCard.test.tsx
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/SiteWorker/components/TodayLogCard.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../../shared/palette';

interface Props {
  checkedOut: number;
  returnedToday: number;
  overdueCount: number;
}

const TodayLogCard: React.FC<Props> = ({ checkedOut, returnedToday, overdueCount }) => (
  <View style={styles.card}>
    <Text style={styles.heading}>TODAY'S LOG</Text>
    <View style={styles.row}>
      <Cell value={checkedOut} label="CHECKED OUT" />
      <Cell value={returnedToday} label="RETURNED" />
      <Cell value={overdueCount} label="OVERDUE" tone="red" />
    </View>
  </View>
);

const Cell: React.FC<{ value: number; label: string; tone?: 'red' }> = ({ value, label, tone }) => (
  <View style={styles.cell}>
    <Text style={[styles.value, tone === 'red' ? styles.valueRed : null]}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: palette.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  heading: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cell: {
    flex: 1,
    alignItems: 'flex-start',
  },
  value: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  valueRed: { color: palette.red },
  label: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 1.0,
    fontWeight: '700',
    marginTop: 4,
  },
});

export default TodayLogCard;
```

- [ ] **Step 4: Run, verify PASS (3 tests)**

```bash
npm test -- src/screens/Dashboard/SiteWorker/components/__tests__/TodayLogCard.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/SiteWorker/components/TodayLogCard.tsx src/screens/Dashboard/SiteWorker/components/__tests__/TodayLogCard.test.tsx
git commit -m "feat(dashboard): add TodayLogCard 3-stat component"
```

---

## Task 13: ActionRow component

**Files:**
- Create: `src/screens/Dashboard/SiteWorker/components/ActionRow.tsx`
- Test: `src/screens/Dashboard/SiteWorker/components/__tests__/ActionRow.test.tsx`

A row in the NEEDS YOUR ACTION list: icon + headline + sub-line + an `ActionButton` CTA.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/SiteWorker/components/__tests__/ActionRow.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ActionRow from '../ActionRow';
import type { ActionRow as ActionRowData } from '../../types';

const baseRow: ActionRowData = {
  id: 'overdue-1',
  kind: 'overdue',
  iconName: 'time-outline',
  primary: 'Bosch GH-3544',
  secondary: 'Return overdue · 4 days',
  cta: { kind: 'return', label: 'Return' },
  payload: { assignmentId: 1, toolId: 200 },
};

describe('ActionRow', () => {
  it('renders primary and secondary text', () => {
    render(<ActionRow row={baseRow} onCtaPress={() => {}} />);
    expect(screen.getByText('Bosch GH-3544')).toBeTruthy();
    expect(screen.getByText('Return overdue · 4 days')).toBeTruthy();
  });

  it('renders the CTA label', () => {
    render(<ActionRow row={baseRow} onCtaPress={() => {}} />);
    expect(screen.getByText('Return')).toBeTruthy();
  });

  it('passes the row to onCtaPress when CTA is pressed', () => {
    const onCtaPress = jest.fn();
    render(<ActionRow row={baseRow} onCtaPress={onCtaPress} />);
    fireEvent.press(screen.getByLabelText('Return'));
    expect(onCtaPress).toHaveBeenCalledWith(baseRow);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- src/screens/Dashboard/SiteWorker/components/__tests__/ActionRow.test.tsx
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/SiteWorker/components/ActionRow.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActionButton from '../../shared/components/ActionButton';
import { palette } from '../../shared/palette';
import type { ActionRow as ActionRowData } from '../types';

interface Props {
  row: ActionRowData;
  onCtaPress: (row: ActionRowData) => void;
}

const ActionRow: React.FC<Props> = ({ row, onCtaPress }) => (
  <View style={styles.row}>
    <View style={styles.iconWrap}>
      <Ionicons name={row.iconName} size={18} color={row.iconTint ?? palette.textSecondary} />
    </View>
    <View style={styles.middle}>
      <Text style={styles.primary} numberOfLines={1}>{row.primary}</Text>
      <Text style={styles.secondary} numberOfLines={1}>{row.secondary}</Text>
    </View>
    <ActionButton kind={row.cta.kind} label={row.cta.label} onPress={() => onCtaPress(row)} />
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1 },
  primary: { color: palette.textPrimary, fontSize: 14, fontWeight: '700' },
  secondary: { color: palette.textMuted, fontSize: 12, marginTop: 2 },
});

export default ActionRow;
```

- [ ] **Step 4: Run, verify PASS (3 tests)**

```bash
npm test -- src/screens/Dashboard/SiteWorker/components/__tests__/ActionRow.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/SiteWorker/components/ActionRow.tsx src/screens/Dashboard/SiteWorker/components/__tests__/ActionRow.test.tsx
git commit -m "feat(dashboard): add ActionRow component"
```

---

## Task 14: SiteWorkerDashboardScreen + role router wiring

**Files:**
- Create: `src/screens/Dashboard/SiteWorker/SiteWorkerDashboardScreen.tsx`
- Modify: `src/screens/Dashboard/DashboardScreen.tsx`
- Modify: `src/screens/Dashboard/__tests__/DashboardScreen.test.tsx`

Composes the screen and wires the role router so `site_worker` lands on the new dashboard.

- [ ] **Step 1: Update DashboardScreen test for site_worker**

Open `src/screens/Dashboard/__tests__/DashboardScreen.test.tsx`. Update the existing test for site_worker. The current site_worker test passes against `StandardDashboard` and asserts on `Scan`/`Report Issue`/`My Tools`/`Notifications`. Replace it with a site-worker dashboard test that asserts the new screen's elements:

Replace the existing block:
```tsx
it('renders 4 QuickAction tiles for worker role', () => {
  currentRole = 'site_worker';
  render(<DashboardScreen />);
  expect(screen.getByLabelText('Scan')).toBeTruthy();
  expect(screen.getByLabelText('Report Issue')).toBeTruthy();
  expect(screen.getByLabelText('My Tools')).toBeTruthy();
  expect(screen.getByLabelText('Notifications')).toBeTruthy();
});
```

with:
```tsx
it('renders site-worker dashboard with Your actions title for site_worker role', () => {
  currentRole = 'site_worker';
  render(<DashboardScreen />);
  expect(screen.getByText('Your actions')).toBeTruthy();
});
```

Also add a `jest.mock` block above the `describe` (after the existing OfficeWorker mocks) so the new screen's hook doesn't try to hit the network during the role-router test:

```tsx
jest.mock('../SiteWorker/hooks/useSiteWorkerData', () => ({
  useSiteWorkerData: () => ({
    isLoading: false,
    refresh: jest.fn(),
    organizationName: 'TESTORG',
    siteTagline: 'TESTORG / SITE',
    userInitials: 'XY',
    hasUnreadAlerts: null,
    checkedOut: 0,
    returnedToday: 0,
    overdueCount: 0,
    rows: [],
  }),
}));
```

- [ ] **Step 2: Run, verify the new test fails (others pass)**

```bash
npm test -- src/screens/Dashboard/__tests__/DashboardScreen.test.tsx
```

Expected: 3 PASS, 1 FAIL ("Your actions" not found).

- [ ] **Step 3: Implement SiteWorkerDashboardScreen**

Create `src/screens/Dashboard/SiteWorker/SiteWorkerDashboardScreen.tsx`:

```tsx
import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DashboardHeader from '../shared/components/DashboardHeader';
import QuickActions, { QuickActionItem } from '../shared/components/QuickActions';
import TodayLogCard from './components/TodayLogCard';
import ActionRow from './components/ActionRow';
import { palette } from '../shared/palette';
import { useAccent } from '../../../theme/AccentContext';
import { useSiteWorkerData } from './hooks/useSiteWorkerData';
import { useScanTag } from '../../../hooks/useScanTag';
import type { ActionRow as ActionRowData } from './types';

const SiteWorkerDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const accent = useAccent();
  const data = useSiteWorkerData();
  const { scan } = useScanTag();

  const quickActions: QuickActionItem[] = useMemo(
    () => [
      { key: 'return',  label: 'Return',   icon: 'arrow-undo-outline', primary: true,  actionKind: 'return',  onPress: () => scan() },
      { key: 'report',  label: 'Report',   icon: 'alert-circle-outline',                    onPress: () => navigation.navigate('CreateReport') },
      { key: 'request', label: 'Request',  icon: 'add-circle-outline',                      onPress: () => navigation.navigate('AllDevices') },
      { key: 'my',      label: 'My tools', icon: 'construct-outline',                       onPress: () => navigation.navigate('tools') },
    ],
    [navigation, scan],
  );

  const handleRowCta = (row: ActionRowData) => {
    if (row.kind === 'flagged' && row.payload.incidentId !== undefined) {
      navigation.navigate('ReportDetails', { id: row.payload.incidentId });
      return;
    }
    if ((row.kind === 'overdue' || row.kind === 'due_today') && row.payload.assignmentId !== undefined) {
      scan();
      return;
    }
    if (row.kind === 'eod') {
      scan();
    }
  };

  const isFirstLoad = data.isLoading && data.rows.length === 0 && data.checkedOut === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={data.isLoading} onRefresh={data.refresh} tintColor={accent.fg} />
        }
      >
        <DashboardHeader
          tagline={data.siteTagline}
          title="Your actions"
          subtitle="What needs your attention today"
          initials={data.userInitials}
          hasUnreadAlerts={data.hasUnreadAlerts}
          onAlertsPress={() => navigation.navigate('NotificationPreferences')}
          onAvatarPress={() => navigation.navigate('settings')}
        />
        <QuickActions items={quickActions} />
        <TodayLogCard
          checkedOut={data.checkedOut}
          returnedToday={data.returnedToday}
          overdueCount={data.overdueCount}
        />

        <View style={styles.headingRow}>
          <Text style={styles.heading}>NEEDS YOUR ACTION</Text>
          <Text style={styles.headingRight}>{data.rows.length}</Text>
        </View>

        {isFirstLoad ? (
          <View style={styles.loader}><ActivityIndicator color={accent.fg} /></View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        {data.rows.length === 0 && !data.isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>All caught up — nothing to action right now.</Text>
          </View>
        ) : (
          data.rows.map((row) => (
            <ActionRow key={row.id} row={row} onCtaPress={handleRowCta} />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 28, paddingTop: 6 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 6,
  },
  heading: { color: palette.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  headingRight: { color: palette.textMuted, fontSize: 12 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: { color: palette.red, fontSize: 12, paddingHorizontal: 18, paddingVertical: 6 },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default SiteWorkerDashboardScreen;
```

- [ ] **Step 4: Wire role router**

Open `src/screens/Dashboard/DashboardScreen.tsx`. Add to imports:

```tsx
import SiteWorkerDashboardScreen from './SiteWorker/SiteWorkerDashboardScreen';
```

In the role-routing block, add a new branch BEFORE the `<StandardDashboard>` fallthrough:

```tsx
  if (role === 'site_worker') {
    return <SiteWorkerDashboardScreen />;
  }
  return <StandardDashboard role={role} />;
```

The full role block should now be:
```tsx
  if (role === 'owner') {
    return <ControlRoomScreen />;
  }
  if (role === 'admin') {
    return <FleetStatusScreen />;
  }
  if (role === 'office_worker') {
    return <OfficeWorkerDashboardScreen />;
  }
  if (role === 'site_worker') {
    return <SiteWorkerDashboardScreen />;
  }
  return <StandardDashboard role={role} />;
```

- [ ] **Step 5: Run all 4 DashboardScreen tests**

```bash
npm test -- src/screens/Dashboard/__tests__/DashboardScreen.test.tsx
```

Expected: PASS, 4 tests (`worker`/`admin`/`owner`/`office_worker` plus the updated `site_worker` test).

- [ ] **Step 6: Commit**

```bash
git add src/screens/Dashboard/SiteWorker/SiteWorkerDashboardScreen.tsx src/screens/Dashboard/DashboardScreen.tsx src/screens/Dashboard/__tests__/DashboardScreen.test.tsx
git commit -m "feat(dashboard): wire SiteWorkerDashboardScreen for site_worker role"
```

---

## Task 15: Full test suite + manual verification

**Files:** none.

- [ ] **Step 1: Full Jest suite**

```bash
npm test
```

Expected: all tests previously passing continue to pass; new tests added in this plan pass. Pre-existing failures from project memory (`AuthFlow`, `BillingService`, `NFCService`, `Button`, `FormField`, `PasswordField`, `NFCUtils`, `e2e/AuthFlow.e2e`) are unrelated and remain.

- [ ] **Step 2: TypeScript typecheck**

```bash
npx tsc --noEmit 2>&1 | head -80
```

Expected: only the pre-existing `tsconfig.json(2,3): error TS5098: Option 'customConditions' …` warning. No new errors.

- [ ] **Step 3: Branch summary**

```bash
git log master..HEAD --oneline | wc -l
git log master..HEAD --oneline
git diff master..HEAD --stat | tail -5
```

Capture commit count and total lines changed.

- [ ] **Step 4: Manual verification on Android dev client**

Log in as each role and confirm:

1. **`site_worker`** — Dashboard tab shows "Your actions". 4 quick action tiles (Return amber primary, Report orange-ish, Request blue-ish, My tools neutral). TODAY'S LOG card shows three counts. NEEDS YOUR ACTION section either shows rows or the "All caught up" empty copy. Scan FAB still works.
2. **`office_worker`** — Dashboard tab still shows the office-worker dashboard (Where/Team segmented control). Active segmented tab still amber.
3. **`admin`** / **`owner`** — Their existing dashboards unchanged visually.
4. **All roles**: Tab through the bottom bar — Tools tab active = blue label, Sites or Incidents active = green/orange, Settings active = violet. The Scan FAB always shows the Q-button image.
5. **Drill-down test**: From office-worker Dashboard → tap a location → on `LocationDetail`, the SegmentedTabs (Users|Tools) active state is amber (Dashboard tab still focused).

- [ ] **Step 5: Push the branch (if you choose to)**

```bash
git push -u origin feature/office-worker-dashboard
```

Plan complete.
