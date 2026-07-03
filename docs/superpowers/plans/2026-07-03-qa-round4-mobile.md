# QA Round 4 Mobile Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the mobile-reproducible QA round-4 items: maintenance/condition display, Find Tool search + quick action, in-app invite composer, Device→Tool label renames, and a "+ Add new" category option.

**Architecture:** All work on branch `qa-round4-mobile` in the mobile repo. No backend changes (user handles the backend separately); every read of a new API field must tolerate `undefined` so the app works before the backend deploys. Spec: `docs/superpowers/specs/2026-07-03-qa-round4-mobile-design.md`.

**Tech Stack:** React Native 0.81 / Expo SDK 54, mixed JS/TS, Jest (`ts-jest` + `babel-jest`), React Navigation v7, axios API layer under `src/api/`.

## Global Constraints

- Branch: `qa-round4-mobile` (already created off master).
- JS-only changes — no new native dependencies (release ships via OTA on runtime 1.0.0).
- Jest baseline: 7 pre-existing failing suites (Button, FormField, PasswordField, AuthFlow, BillingService, NFCService, NFCUtils). Run tests with:
  `npx jest --testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\." <path>` — no NEW failures allowed.
- Backend field contract (fields may be ABSENT until backend ships): `ToolRead` gains `maintenance_interval_days?: number|null`, `next_maintenance_date?: string|null` (YYYY-MM-DD), `warranty_expiry?: string|null`, `purchase_date?: string|null`, `purchase_cost?: string|number|null`, `condition_score?: string|number|null` (1.0–10.0); `ToolCreate`/`ToolUpdate` accept `maintenance_interval_days`, `next_maintenance_date`. Unknown request fields are ignored by django-ninja, so sending them early is safe.
- User-facing copy says "tool", not "device". Do not rename files, routes, components, or identifiers — strings only.
- `@/` path alias is NOT used in existing `src/` imports — use relative imports to match surrounding code.

---

### Task 1: Maintenance/condition pure helpers

**Files:**
- Create: `src/utils/toolMaintenance.ts`
- Test: `src/tests/unit/toolMaintenance.test.ts`

**Interfaces:**
- Produces: `conditionLabelFromScore(score?: number|string|null): string`, `computeNextMaintenanceDate(intervalDays: number, from?: Date): Date`, `toYMD(d: Date): string`. Tasks 2 and 3 import these from `../utils/toolMaintenance` (adjust relative depth per importer).

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/unit/toolMaintenance.test.ts
import {
  conditionLabelFromScore,
  computeNextMaintenanceDate,
  toYMD,
} from '../../utils/toolMaintenance';

describe('conditionLabelFromScore', () => {
  it('returns OK when no score recorded', () => {
    expect(conditionLabelFromScore(null)).toBe('OK');
    expect(conditionLabelFromScore(undefined)).toBe('OK');
    expect(conditionLabelFromScore('')).toBe('OK');
  });

  it('maps numeric bands per backend lifecycle thresholds (≤4 low)', () => {
    expect(conditionLabelFromScore(9)).toBe('Good');
    expect(conditionLabelFromScore(7.1)).toBe('Good');
    expect(conditionLabelFromScore(7)).toBe('Fair');
    expect(conditionLabelFromScore(4.1)).toBe('Fair');
    expect(conditionLabelFromScore(4)).toBe('Poor');
    expect(conditionLabelFromScore('2.5')).toBe('Poor');
  });

  it('returns OK for unparseable input', () => {
    expect(conditionLabelFromScore('not-a-number')).toBe('OK');
  });
});

describe('computeNextMaintenanceDate', () => {
  it('adds the interval in days', () => {
    const from = new Date(2026, 6, 3); // 2026-07-03 local
    expect(toYMD(computeNextMaintenanceDate(90, from))).toBe('2026-10-01');
  });

  it('rolls over month/year boundaries', () => {
    const from = new Date(2026, 11, 20); // 2026-12-20
    expect(toYMD(computeNextMaintenanceDate(30, from))).toBe('2027-01-19');
  });
});

describe('toYMD', () => {
  it('zero-pads month and day', () => {
    expect(toYMD(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/unit/toolMaintenance.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: FAIL — "Cannot find module '../../utils/toolMaintenance'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/toolMaintenance.ts
// Condition bands follow backend lifecycle.py: condition_score is 1.0–10.0
// and ≤4 raises the "low condition" replacement flag. A tool with no
// recorded score is presumed fine ("OK") rather than shown as a dash.
export function conditionLabelFromScore(
  score: number | string | null | undefined,
): string {
  if (score == null || score === '') return 'OK';
  const n = Number(score);
  if (Number.isNaN(n)) return 'OK';
  if (n > 7) return 'Good';
  if (n > 4) return 'Fair';
  return 'Poor';
}

export function computeNextMaintenanceDate(
  intervalDays: number,
  from: Date = new Date(),
): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + intervalDays);
  return d;
}

export function toYMD(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tests/unit/toolMaintenance.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/toolMaintenance.ts src/tests/unit/toolMaintenance.test.ts
git commit -m "feat(maintenance): condition label + next-due date helpers"
```

---

### Task 2: Surface lifecycle fields through types/adapter and fix render sites

**Files:**
- Modify: `src/api/types.ts` (append after the existing tool type exports)
- Modify: `src/api/adapters.ts:94-106` (`toLegacyDevice`) and the `LegacyDevice` interface directly above it
- Modify: `src/components/StandardDeviceCard.js:38-47`
- Modify: `src/screens/DeviceDetailsScreen.js:438-455`
- Modify: `src/screens/components/ModalComponents.js:204-217`
- Test: `src/tests/unit/adapters.test.ts` (extend if it exists; create otherwise)

**Interfaces:**
- Consumes: `conditionLabelFromScore` from Task 1.
- Produces: `LegacyDevice` gains optional `maintenance_interval`, `next_maintenance_date`, `condition_score`, `warranty_expiry`, `purchase_date`, `purchase_cost`. `ToolLifecycleFields` exported from `src/api/types.ts`. Task 3 relies on the legacy field names when rendering after create.

- [ ] **Step 1: Add the contract type in `src/api/types.ts`**

Append near the other Tool type exports:

```ts
// Lifecycle fields the backend exposes on ToolRead per the QA round-4
// contract. Optional/absent until docs/api/openapi.json is regenerated
// after the backend ships — every consumer must tolerate undefined.
export interface ToolLifecycleFields {
  maintenance_interval_days?: number | null;
  next_maintenance_date?: string | null;
  warranty_expiry?: string | null;
  purchase_date?: string | null;
  purchase_cost?: string | number | null;
  condition_score?: string | number | null;
}
```

- [ ] **Step 2: Write the failing adapter test**

If `src/tests/unit/adapters.test.ts` exists, add this describe block; otherwise create the file:

```ts
import { toLegacyDevice } from '../../api/adapters';

describe('toLegacyDevice lifecycle fields', () => {
  const base = {
    id: 1, uuid: 'u', name: 'Drill', make: 'M', model: 'X',
    serial_number: 's', category_id: null, category_name: '',
    nfc_tag_id: null, status: 'available', status_label: 'Available',
    is_available: true,
  } as any;

  it('passes through lifecycle fields when present', () => {
    const d = toLegacyDevice({
      ...base,
      maintenance_interval_days: 90,
      next_maintenance_date: '2026-10-01',
      condition_score: '8.0',
      warranty_expiry: '2027-01-01',
    });
    expect(d.maintenance_interval).toBe(90);
    expect(d.next_maintenance_date).toBe('2026-10-01');
    expect(d.condition_score).toBe('8.0');
    expect(d.warranty_expiry).toBe('2027-01-01');
  });

  it('defaults lifecycle fields to null when the API omits them', () => {
    const d = toLegacyDevice(base);
    expect(d.maintenance_interval).toBeNull();
    expect(d.next_maintenance_date).toBeNull();
    expect(d.condition_score).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/tests/unit/adapters.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: FAIL — `maintenance_interval` is `undefined`, not 90/null

- [ ] **Step 4: Extend `LegacyDevice` + `toLegacyDevice` in `src/api/adapters.ts`**

Add to the `LegacyDevice` interface (keep existing members):

```ts
  maintenance_interval?: number | null;
  next_maintenance_date?: string | null;
  condition_score?: string | number | null;
  warranty_expiry?: string | null;
  purchase_date?: string | null;
  purchase_cost?: string | number | null;
```

Change `toLegacyDevice` to read the optional fields (import `ToolLifecycleFields` from `./types`):

```ts
export function toLegacyDevice(t: ToolRead & ToolLifecycleFields): LegacyDevice {
  return {
    id: t.id,
    identifier: t.name,
    device_type: t.category_name ?? '',
    make: t.make ?? '',
    model: t.model ?? '',
    serial_number: t.serial_number ?? '',
    status: t.status ?? '',
    nfc_tag_id: t.nfc_tag_id ?? null,
    is_available: t.is_available,
    maintenance_interval: t.maintenance_interval_days ?? null,
    next_maintenance_date: t.next_maintenance_date ?? null,
    condition_score: t.condition_score ?? null,
    warranty_expiry: t.warranty_expiry ?? null,
    purchase_date: t.purchase_date ?? null,
    purchase_cost: t.purchase_cost ?? null,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/tests/unit/adapters.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: PASS

- [ ] **Step 6: Fix the three render sites**

`src/components/StandardDeviceCard.js:38-47` — show next-due whenever a date exists (old code required BOTH interval and a field name that never existed):

```js
  const renderMaintenanceInfo = () => {
    const nextDue = device.next_maintenance_date || device.next_maintenance;
    if (nextDue) {
      return (
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Next Maintenance: {nextDue}
        </Text>
      );
    }
    return null;
  };
```

`src/screens/DeviceDetailsScreen.js` — import the helper at the top of the file:

```js
import { conditionLabelFromScore } from '../utils/toolMaintenance';
```

Replace the `device.next_maintenance` block (lines 450-455) and add Condition + Warranty rows after the Status row (line 441):

```jsx
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Condition:</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {conditionLabelFromScore(device.condition_score)}
              </Text>
            </View>

            {device.warranty_expiry && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Warranty Until:</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{formatDate(device.warranty_expiry)}</Text>
              </View>
            )}
```

```jsx
            {(device.next_maintenance_date || device.next_maintenance) && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Next Maintenance:</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {formatDate(device.next_maintenance_date || device.next_maintenance)}
                </Text>
              </View>
            )}
```

`src/screens/components/ModalComponents.js:212-217`:

```jsx
        {(device.next_maintenance_date || device.next_maintenance) && (
          <DetailRow
            label="Next Maintenance"
            value={new Date(device.next_maintenance_date || device.next_maintenance).toLocaleDateString()}
          />
        )}
```

(The `|| device.next_maintenance` fallback everywhere covers stale NFC-tag JSON payloads that used the old key.)

- [ ] **Step 7: Run the full baseline to confirm no new failures**

Run: `npx jest --testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\."`
Expected: only the 7 known suites fail

- [ ] **Step 8: Commit**

```bash
git add src/api/types.ts src/api/adapters.ts src/tests/unit/adapters.test.ts \
  src/components/StandardDeviceCard.js src/screens/DeviceDetailsScreen.js \
  src/screens/components/ModalComponents.js
git commit -m "fix(maintenance): read next_maintenance_date + show condition instead of nothing"
```

---

### Task 3: Add Tool sends maintenance fields; next-due auto-computed from interval

**Files:**
- Modify: `src/screens/AddDeviceScreen.js` — state (~line 60-90), interval input handler (line 796), date picker onChange (line 818-823), `handleSubmit` toolPayload (lines 376-383)

**Interfaces:**
- Consumes: `computeNextMaintenanceDate`, `toYMD` from Task 1 (`../utils/toolMaintenance`).
- Produces: create payload includes `maintenance_interval_days: number` and `next_maintenance_date: 'YYYY-MM-DD'` when the interval field is filled.

- [ ] **Step 1: Add import and manual-date tracking state**

Import at top of file:

```js
import { computeNextMaintenanceDate, toYMD } from '../utils/toolMaintenance';
```

Next to the existing `showDatePicker` state, add:

```js
  // True once the user has explicitly picked a next-maintenance date; stops
  // the interval field from overwriting their choice.
  const [dateManuallySet, setDateManuallySet] = useState(false);
```

- [ ] **Step 2: Auto-compute the date from the interval**

Replace the interval `onChangeText` (line 796):

```js
                onChangeText={(text) => {
                  const clean = text.replace(/[^0-9]/g, '');
                  handleInputChange('maintenance_interval', clean);
                  if (!dateManuallySet && clean) {
                    handleInputChange(
                      'next_maintenance_date',
                      computeNextMaintenanceDate(Number(clean)),
                    );
                  }
                }}
```

In the DateTimePicker `onChange` (lines 818-823), mark manual edits:

```js
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setDateManuallySet(true);
                      handleInputChange('next_maintenance_date', selectedDate);
                    }
                  }}
```

- [ ] **Step 3: Send the fields on create**

In `handleSubmit`, extend `toolPayload` (lines 376-383):

```js
      const toolPayload = {
        name: formData.description || `${finalMake || ''} ${formData.model}`.trim() || 'New Tool',
        make: finalMake || '',
        model: formData.model || '',
        serial_number: formData.serial_number || '',
        ...(matchedId != null ? { category_id: matchedId } : { category: formData.category }),
        nfc_tag_id: preScannedNfcTagId ?? null,
        // QA round-4 contract — ignored by the backend until it ships the
        // ToolCreate fields, then persisted. Only sent when an interval is set.
        ...(formData.maintenance_interval
          ? {
              maintenance_interval_days: Number(formData.maintenance_interval),
              next_maintenance_date: toYMD(formData.next_maintenance_date),
            }
          : {}),
      };
```

Also reset `setDateManuallySet(false)` inside the existing form-reset function (the one restoring `next_maintenance_date: twoWeeksFromNow` at ~line 490).

- [ ] **Step 4: Manual smoke check of the logic path**

Run: `npx jest src/tests/unit/toolMaintenance.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: PASS. (AddDeviceScreen has no existing component test; the payload logic is exercised through the helpers. Do NOT add a new screen-level test harness for this legacy 1,500-line JS screen.)

- [ ] **Step 5: Commit**

```bash
git add src/screens/AddDeviceScreen.js
git commit -m "feat(add-tool): send maintenance interval + auto-computed next-due date"
```

---

### Task 4: Tools search + Find Tool quick action

**Files:**
- Create: `src/screens/Tools/hooks/filterGroups.ts`
- Test: `src/tests/unit/filterGroups.test.ts`
- Modify: `src/screens/Tools/hooks/useMyTools.ts:9-16` (`ToolItem`), `:74-91` (`groupAll`)
- Modify: `src/screens/Tools/ToolsScreen.tsx`
- Modify: `src/screens/Dashboard/quickActions.ts:13-20`
- Modify: `src/screens/Dashboard/ControlRoom/ControlRoomScreen.tsx:22-52`
- Modify: `src/screens/Dashboard/FleetStatus/FleetStatusScreen.tsx` (same tile if it has a QuickActions list — check its structure, mirror ControlRoom)
- Modify test: `src/screens/Dashboard/__tests__/quickActions.test.ts`

**Interfaces:**
- Consumes: `SiteGroup`, `ToolItem` from `useMyTools`.
- Produces: `filterGroupsByQuery(groups: SiteGroup[], query: string): SiteGroup[]`; `ToolItem` gains `serial?: string`; ToolsScreen accepts route param `focusSearch?: boolean`.

- [ ] **Step 1: Write the failing filter test**

```ts
// src/tests/unit/filterGroups.test.ts
import { filterGroupsByQuery } from '../../screens/Tools/hooks/filterGroups';
import type { SiteGroup } from '../../screens/Tools/hooks/useMyTools';

const groups: SiteGroup[] = [
  {
    siteId: 'a', siteName: 'Depot', siteType: 'location',
    tools: [
      { id: '1', identifier: 'Makita Drill', toolType: 'Tool', serial: 'SN-001', status: 'available' },
      { id: '2', identifier: 'Ladder', toolType: 'Equipment', serial: 'SN-002', status: 'available' },
    ],
  },
  {
    siteId: 'b', siteName: 'Van 3', siteType: 'van',
    tools: [{ id: '3', identifier: 'Grinder', toolType: 'Tool', status: 'assigned' }],
  },
];

describe('filterGroupsByQuery', () => {
  it('returns groups unchanged for empty/whitespace query', () => {
    expect(filterGroupsByQuery(groups, '')).toBe(groups);
    expect(filterGroupsByQuery(groups, '   ')).toBe(groups);
  });

  it('matches identifier case-insensitively', () => {
    const out = filterGroupsByQuery(groups, 'makita');
    expect(out).toHaveLength(1);
    expect(out[0].tools.map(t => t.id)).toEqual(['1']);
  });

  it('matches serial and toolType', () => {
    expect(filterGroupsByQuery(groups, 'sn-002')[0].tools[0].id).toBe('2');
    expect(filterGroupsByQuery(groups, 'equipment')[0].tools[0].id).toBe('2');
  });

  it('drops groups with no matching tools', () => {
    const out = filterGroupsByQuery(groups, 'grinder');
    expect(out).toHaveLength(1);
    expect(out[0].siteId).toBe('b');
  });

  it('tolerates tools with missing optional fields', () => {
    expect(filterGroupsByQuery(groups, 'zzz-no-match')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/unit/filterGroups.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the filter + `serial` field**

```ts
// src/screens/Tools/hooks/filterGroups.ts
import type { SiteGroup } from './useMyTools';

export function filterGroupsByQuery(groups: SiteGroup[], query: string): SiteGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      tools: g.tools.filter((t) =>
        [t.identifier, t.toolType, t.serial]
          .some((v) => (v ?? '').toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.tools.length > 0);
}
```

In `useMyTools.ts` add `serial?: string;` to `ToolItem` (line 15 area) and map it in `groupAll` (`ToolRead` has `serial_number`):

```ts
  const items: ToolItem[] = tools.map((t) => ({
    id: String(t.id),
    identifier: t.name,
    toolType: t.category_name || [t.make, t.model].filter(Boolean).join(' ') || undefined,
    serial: t.serial_number || undefined,
    holderLabel: t.is_available ? 'Available' : 'In use',
    status: mapToolStatus(t.status),
  }));
```

(`groupMine` items get no serial — `AssignmentRead` doesn't carry it; the filter treats it as absent.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tests/unit/filterGroups.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: PASS

- [ ] **Step 5: Wire search UI into `ToolsScreen.tsx`**

Full updated screen (replaces the current file body — keep the existing styles keys and add the new ones):

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMyTools, ToolItem } from './hooks/useMyTools';
import { filterGroupsByQuery } from './hooks/filterGroups';
import SiteGroupHeader from './components/SiteGroupHeader';
import ToolsListItem from './components/ToolsListItem';
import AdminToolsToggle from './components/AdminToolsToggle';

const ToolsScreen: React.FC = () => {
  const { userData } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isAdminOrOwner = userData?.role === 'admin' || userData?.role === 'owner';
  const { isLoading, hasLoadedOnce, groups, filter, setFilter, error } = useMyTools(
    isAdminOrOwner ? 'all' : 'mine'
  );

  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  // "Find Tool" quick action lands here with focusSearch — focus once per visit.
  useEffect(() => {
    if (route.params?.focusSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 300);
      navigation.setParams({ focusSearch: undefined });
      return () => clearTimeout(t);
    }
  }, [route.params?.focusSearch, navigation]);

  const visibleGroups = useMemo(() => filterGroupsByQuery(groups, query), [groups, query]);
  const sections = visibleGroups.map(g => ({ title: g.siteName, data: g.tools, group: g }));

  const handleToolPress = (t: ToolItem) => navigation.navigate('DeviceDetails', { deviceId: t.id });

  if (isLoading && !hasLoadedOnce) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading tools…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          ref={searchRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search tools by name, serial, make…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search tools"
          testID="tools-search-input"
        />
        {query ? (
          <Ionicons
            name="close-circle"
            size={18}
            color={colors.textSecondary}
            onPress={() => setQuery('')}
            accessibilityLabel="Clear search"
          />
        ) : null}
      </View>
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
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          hasLoadedOnce && !isLoading && !error ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {query ? 'No tools match your search.' : 'No tools yet. Tap Scan to check a tag.'}
              </Text>
            </View>
          ) : null
        }
        stickySectionHeadersEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  toggleWrap: { paddingHorizontal: 12, paddingBottom: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 10, fontSize: 14 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});

export default ToolsScreen;
```

- [ ] **Step 6: Add the quick actions**

`src/screens/Dashboard/quickActions.ts` — append to `WORKER_ACTIONS` (after `myTools`):

```ts
  { key: 'findTool',      label: 'Find Tool',     icon: 'search-circle-outline', destination: 'MainTabs', params: { screen: 'tools', params: { focusSearch: true } } },
```

`ControlRoomScreen.tsx` — add to the `quickActions` array (after the `add` tile):

```ts
      {
        key: 'findTool',
        label: 'Find',
        icon: 'search-outline',
        onPress: () => navigation.navigate('tools', { focusSearch: true }),
      },
```

`FleetStatusScreen.tsx` — read the file; if it renders the shared `QuickActions` component, add the same tile; if it has no quick-action strip, skip it (note the skip in the commit message).

- [ ] **Step 7: Update the quick-actions test**

`src/screens/Dashboard/__tests__/quickActions.test.ts` asserts action key sets/counts. Add `'findTool'` to the expected worker keys and bump any length assertions accordingly (read the test, keep its existing style).

- [ ] **Step 8: Run affected tests**

Run: `npx jest src/tests/unit/filterGroups.test.ts src/screens/Dashboard/__tests__/quickActions.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/screens/Tools/ src/screens/Dashboard/ src/tests/unit/filterGroups.test.ts
git commit -m "feat(tools): search on Tools screen + Find Tool quick action"
```

---

### Task 5: In-app invite composer + pending invitations on Members screen

**Files:**
- Create: `src/screens/Members/InviteMemberSheet.tsx`
- Modify: `src/screens/Members/MembersScreen.tsx`
- Test: `src/screens/Members/__tests__/inviteValidation.test.ts`

**Interfaces:**
- Consumes: `createInvitation`, `listInvitations`, `resendInvitation`, `revokeInvitation` from `src/api/endpoints/invitations.ts`. (Email validation is a local `EMAIL_RE` in the sheet — same pattern the onboarding invite step uses; do not import CommonUtils.)
- Produces: `<InviteMemberSheet visible onClose onSent(inv: InvitationRead) roles: Role[] />`; MembersScreen shows a header invite button + "Pending invitations" list section.

- [ ] **Step 1: Write the failing validation test**

The sheet's submit-enable logic lives in a small exported helper so it's testable without rendering:

```ts
// src/screens/Members/__tests__/inviteValidation.test.ts
import { canSubmitInvite } from '../InviteMemberSheet';

describe('canSubmitInvite', () => {
  it('requires a valid email', () => {
    expect(canSubmitInvite('', 'site_worker')).toBe(false);
    expect(canSubmitInvite('nope', 'site_worker')).toBe(false);
    expect(canSubmitInvite('a@b.com', 'site_worker')).toBe(true);
  });
  it('requires a role', () => {
    expect(canSubmitInvite('a@b.com', '')).toBe(false);
  });
  it('trims whitespace', () => {
    expect(canSubmitInvite('  a@b.com  ', 'admin')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/screens/Members/__tests__/inviteValidation.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: FAIL — module not found

- [ ] **Step 3: Build `InviteMemberSheet.tsx`**

```tsx
// src/screens/Members/InviteMemberSheet.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import * as invitationsApi from '../../api/endpoints/invitations';
import type { InvitationRead } from '../../api/types';
import { ApiError } from '../../api/errors';

type Role = 'owner' | 'admin' | 'office_worker' | 'site_worker';

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  office_worker: 'Office worker',
  site_worker: 'Site worker',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canSubmitInvite(email: string, role: string): boolean {
  return EMAIL_RE.test(email.trim()) && !!role;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSent: (inv: InvitationRead) => void;
  roles: Role[];
}

const InviteMemberSheet: React.FC<Props> = ({ visible, onClose, onSent, roles }) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('site_worker');
  const [sending, setSending] = useState(false);

  const reset = () => {
    setEmail('');
    setRole('site_worker');
  };

  const handleSend = async () => {
    if (!canSubmitInvite(email, role) || sending) return;
    setSending(true);
    try {
      const inv = await invitationsApi.createInvitation({ email: email.trim(), role });
      reset();
      onSent(inv);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Could not send the invitation. Please try again.';
      Alert.alert('Invite failed', msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Invite a team member</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            They'll receive an email with a link to join your organization.
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email@company.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            accessibilityLabel="Invitee email"
            testID="invite-email-input"
          />
          <View style={styles.roleRow}>
            {roles.map((r) => {
              const active = role === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={[
                    styles.rolePill,
                    { borderColor: active ? colors.primary : colors.border },
                    active && { backgroundColor: colors.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Role ${ROLE_LABEL[r]}`}
                >
                  <Text style={[styles.rolePillText, { color: active ? '#000' : colors.textPrimary }]}>
                    {ROLE_LABEL[r]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: colors.primary },
              (!canSubmitInvite(email, role) || sending) && styles.sendBtnDisabled,
            ]}
            disabled={!canSubmitInvite(email, role) || sending}
            onPress={handleSend}
            accessibilityRole="button"
            accessibilityLabel="Send invitation"
            testID="invite-send-button"
          >
            {sending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.sendBtnText}>Send Invitation</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: { padding: 20, paddingBottom: 32, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  rolePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  rolePillText: { fontSize: 13, fontWeight: '600' },
  sendBtn: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  cancelBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600' },
});

export default InviteMemberSheet;
```

- [ ] **Step 4: Run validation test to verify it passes**

Run: `npx jest src/screens/Members/__tests__/inviteValidation.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: PASS

- [ ] **Step 5: Integrate into `MembersScreen.tsx`**

Additions (keep everything else as-is):

1. Imports:
```tsx
import * as invitationsApi from '../../api/endpoints/invitations';
import type { InvitationRead } from '../../api/types';
import InviteMemberSheet from './InviteMemberSheet';
```

2. State + load: alongside `members` state add
```tsx
  const [invites, setInvites] = useState<InvitationRead[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteBusyId, setInviteBusyId] = useState<number | null>(null);
```
Inside `load()` after `setMembers(...)`, fetch pending invites non-fatally:
```tsx
      try {
        const invPage = await invitationsApi.listInvitations();
        setInvites(invPage.items.filter((i) => i.status === 'pending'));
      } catch {
        // Pending invites are supplementary — ignore load failures.
      }
```

3. Header invite button — replace the right-side spacer `<View style={styles.backBtn} />` (line 252):
```tsx
        <TouchableOpacity
          onPress={() => setInviteOpen(true)}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Invite a member"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="person-add-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
```

4. Pending invites section — add `ListHeaderComponent` to the members `FlatList`:
```tsx
          ListHeaderComponent={
            invites.length > 0 ? (
              <View style={styles.invitesBlock}>
                <Text style={[styles.invitesTitle, { color: colors.textSecondary }]}>
                  PENDING INVITATIONS
                </Text>
                {invites.map((inv) => (
                  <View
                    key={inv.id}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.row}>
                      <View style={styles.info}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                          {inv.email}
                        </Text>
                        <Text style={[styles.email, { color: colors.textSecondary }]}>
                          {ROLE_LABEL[inv.role as Role] ?? inv.role} · invited
                        </Text>
                      </View>
                      {inviteBusyId === inv.id ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <View style={styles.actions}>
                          <TouchableOpacity
                            style={[styles.iconBtn, { borderColor: colors.border }]}
                            onPress={() => handleResend(inv)}
                            accessibilityRole="button"
                            accessibilityLabel={`Resend invitation to ${inv.email}`}
                          >
                            <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconBtn, { borderColor: colors.border }]}
                            onPress={() => handleRevoke(inv)}
                            accessibilityRole="button"
                            accessibilityLabel={`Revoke invitation to ${inv.email}`}
                          >
                            <Ionicons name="trash-outline" size={18} color="#F85149" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
```

5. Handlers (near `handleRemove`):
```tsx
  const handleResend = useCallback(async (inv: InvitationRead) => {
    setInviteBusyId(inv.id);
    try {
      await invitationsApi.resendInvitation(inv.id);
      Alert.alert('Invitation resent', `A new invitation email was sent to ${inv.email}.`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      Alert.alert(
        'Resend failed',
        err instanceof ApiError ? err.message : 'Could not resend the invitation. Please try again.',
      );
    } finally {
      setInviteBusyId(null);
    }
  }, []);

  const handleRevoke = useCallback((inv: InvitationRead) => {
    Alert.alert('Revoke invitation', `Revoke the invitation to ${inv.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          setInviteBusyId(inv.id);
          try {
            await invitationsApi.revokeInvitation(inv.id);
            setInvites((prev) => prev.filter((i) => i.id !== inv.id));
          } catch (err) {
            if (err instanceof ApiError && err.code === 'unauthorized') return;
            Alert.alert(
              'Revoke failed',
              err instanceof ApiError ? err.message : 'Could not revoke the invitation. Please try again.',
            );
          } finally {
            setInviteBusyId(null);
          }
        },
      },
    ]);
  }, []);
```

6. Sheet at the bottom, next to the existing role Modal:
```tsx
      <InviteMemberSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSent={(inv) => {
          setInviteOpen(false);
          setInvites((prev) => [inv, ...prev.filter((i) => i.id !== inv.id)]);
          Alert.alert('Invitation sent', `${inv.email} has been invited.`);
        }}
        roles={availableRoles}
      />
```

7. Styles — add:
```tsx
  invitesBlock: { marginBottom: 14 },
  invitesTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
```

Note: `availableRoles` already exists (owner-gated). The invite button is visible to whoever can reach this screen (quick action is admin/owner-only); the API enforces permissions server-side.

- [ ] **Step 6: Run baseline to confirm nothing broke**

Run: `npx jest --testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\."`
Expected: only the 7 known suites fail

- [ ] **Step 7: Commit**

```bash
git add src/screens/Members/
git commit -m "feat(members): invite composer + pending invitations with resend/revoke"
```

---

### Task 6: User-facing Device→Tool label renames

**Files:**
- Modify: `src/screens/home/components/HomeHeader.js:58-63` ("Assign Device" button title/accessibility)
- Modify: `src/screens/home/components/AssignDevice/AssignDeviceModal.js:90` (modal title)
- Modify: `src/screens/QuickAction/QuickActionModalScreen.tsx` (visible "device" strings: alerts at ~233/258, fallback at 427)
- Modify: `src/screens/LocationDetailsScreen.js:383,406` ("Add New Device"), `src/screens/LocationsScreen.js:417` ("View Available Devices")
- Modify: `src/screens/AllDevicesScreen.js` return-modal title ("Return Device")

**Interfaces:** none (copy only).

- [ ] **Step 1: Find every candidate string**

Run:
```bash
grep -rn --include='*.js' --include='*.tsx' -E '"[^"]*[Dd]evice[^"]*"|'"'"'[^'"'"']*[Dd]evice[^'"'"']*'"'"'' \
  src/screens/home/components/HomeHeader.js \
  src/screens/home/components/AssignDevice/AssignDeviceModal.js \
  src/screens/QuickAction/QuickActionModalScreen.tsx \
  src/screens/LocationDetailsScreen.js src/screens/LocationsScreen.js \
  src/screens/AllDevicesScreen.js src/screens/DeviceDetailsScreen.js | grep -viE 'navigate|screen|testID|import|require|style'
```

- [ ] **Step 2: Apply renames — user-visible strings only**

Rules: `Assign Device`→`Assign Tool`, `Add New Device`→`Add New Tool`, `View Available Devices`→`View Available Tools`, `Return Device`→`Return Tool`, alert copy `device`→`tool` (e.g. "This device has no active assignment to return." → "This tool has no active assignment to return."; "Device has been returned successfully." → "Tool has been returned successfully."; fallback `'Device'`→`'Tool'` at QuickActionModalScreen:427). Keep `navigation.navigate('DeviceDetails' …)`, `AddDevice` route names, testIDs, and variable names untouched. Screen headers rendered from navigation options: check `src/navigation/index.tsx` for visible titles like "Device Details" and rename those strings too (`title: 'Tool Details'`) without touching route keys.

- [ ] **Step 3: Verify no functional identifiers changed**

Run: `git diff --stat` and eyeball the diff: every hunk should touch only string literals inside JSX/Alert/title props.
Run: `npx jest --testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\."`
Expected: only the 7 known suites fail (if a test asserts on renamed copy, update the test's expected string — it's a copy test, not behavior).

- [ ] **Step 4: Commit**

```bash
git add -A src/
git commit -m "chore(copy): rename user-facing Device labels to Tool"
```

---

### Task 7: Category "+ Add new" option in Add Tool

**Files:**
- Modify: `src/screens/AddDeviceScreen.js` — `fetchCategories` (lines 180-199), category dropdown JSX (lines 765-779), validation (`validateForm` ~line 340), submit (`handleSubmit` line 375-383)
- Test: `src/tests/unit/deviceCategories.test.ts` (extend)

**Interfaces:**
- Consumes: `DEVICE_CATEGORIES`, `matchCategoryId` from `src/constants/deviceCategories.ts`.
- Produces: sentinel option value `ADD_NEW_CATEGORY` exported from `src/constants/deviceCategories.ts`.

- [ ] **Step 1: Write the failing test (extend `src/tests/unit/deviceCategories.test.ts`)**

```ts
import { ADD_NEW_CATEGORY, resolveCategoryLabel } from '../../constants/deviceCategories';
// NOTE: the existing test file already imports from '../../constants/deviceCategories' — extend it, keep its path style.

describe('resolveCategoryLabel', () => {
  it('returns the picked fixed category as-is', () => {
    expect(resolveCategoryLabel('Tool', 'ignored')).toBe('Tool');
  });
  it('returns the trimmed custom name when Add new is selected', () => {
    expect(resolveCategoryLabel(ADD_NEW_CATEGORY, '  PPE  ')).toBe('PPE');
  });
  it('returns empty string when Add new is selected but no name typed', () => {
    expect(resolveCategoryLabel(ADD_NEW_CATEGORY, '   ')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/unit/deviceCategories.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: FAIL — `ADD_NEW_CATEGORY` not exported

- [ ] **Step 3: Implement in `src/constants/deviceCategories.ts`**

```ts
// Sentinel dropdown value for the "+ Add new…" option (not a real category).
export const ADD_NEW_CATEGORY = '__add_new__';

// The effective category label to submit: the picked fixed label, or the
// user-typed custom name when "+ Add new…" is selected.
export function resolveCategoryLabel(picked: string, customName: string): string {
  return picked === ADD_NEW_CATEGORY ? customName.trim() : picked;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tests/unit/deviceCategories.test.ts --testPathIgnorePatterns "/node_modules/" "\.worktrees"`
Expected: PASS

- [ ] **Step 5: Wire into `AddDeviceScreen.js`**

Import: add `ADD_NEW_CATEGORY, resolveCategoryLabel` to the existing `deviceCategories` import.

State: `const [customCategory, setCustomCategory] = useState('');`

`fetchCategories` — append the sentinel option after the fixed ones (line 187):

```js
    options.push({ label: '+ Add new…', value: ADD_NEW_CATEGORY, key: 'category-add-new' });
    setCategoryOptions(options);
```

Dropdown JSX (after the `</Dropdown>` closing, inside the same `formField` View, lines 765-779):

```jsx
              {formData.category === ADD_NEW_CATEGORY && (
                <BaseTextInput
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  placeholder="New category name (e.g. PPE, Machinery)"
                  style={{ marginTop: 8 }}
                  testID="custom-category-input"
                />
              )}
```

`validateForm` — before the assignment checks (~line 340):

```js
    if (formData.category === ADD_NEW_CATEGORY && !customCategory.trim()) {
      missingFields.push('New category name');
    }
```

`handleSubmit` — replace the category lines (375-381):

```js
      const categoryLabel = resolveCategoryLabel(formData.category, customCategory);
      const matchedId = matchCategoryId(categoryLabel, backendCategories);
      const toolPayload = {
        // …unchanged fields…
        ...(matchedId != null
          ? { category_id: matchedId }
          : categoryLabel
            ? { category: categoryLabel }
            : {}),
        // …unchanged fields…
      };
```

Also update the later 400-retry log path: it destructures `category` out of the payload — unchanged behavior, no edit needed. Reset `setCustomCategory('')` in the form-reset function (~line 490).

- [ ] **Step 6: Run baseline**

Run: `npx jest --testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\."`
Expected: only the 7 known suites fail

- [ ] **Step 7: Commit**

```bash
git add src/constants/deviceCategories.ts src/tests/unit/deviceCategories.test.ts src/screens/AddDeviceScreen.js
git commit -m "feat(add-tool): '+ Add new' category option sending custom category name"
```

---

### Task 8: Changelog, full verification, PR

**Files:**
- Modify: `src/constants/changelog.ts` (bump `CHANGELOG_VERSION`, add entries)

- [ ] **Step 1: Bump the What's New changelog**

Read `src/constants/changelog.ts`, follow its existing entry format. Set `CHANGELOG_VERSION = '1.4.1'` and add entries: tools search + Find Tool quick action; invite teammates from Members; next-service-due and condition now shown on tools; custom categories; tool wording.

- [ ] **Step 2: Full test run**

Run: `npx jest --testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\."`
Expected: only the 7 known pre-existing suites fail. Paste the summary into the PR description.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no NEW errors versus master (`git stash` compare not needed — run once on master beforehand if unsure; the repo is `strict: false` and may have pre-existing noise).

- [ ] **Step 4: Commit changelog + push + PR**

```bash
git add src/constants/changelog.ts
git commit -m "chore(release): changelog 1.4.1 for QA round-4 mobile fixes"
git push -u origin qa-round4-mobile
gh pr create --title "QA round 4: maintenance/condition display, tools search, in-app invites, tool wording" \
  --body "$(cat <<'EOF'
## Summary
- Show next-service-due + condition on tool cards/details (reads new backend lifecycle fields, degrades gracefully until backend ships)
- Add Tool sends maintenance_interval_days + auto-computed next_maintenance_date
- Tools screen search + "Find Tool" quick action
- Invite teammates from Members (composer + pending list with resend/revoke)
- "+ Add new" category option on Add Tool
- User-facing "Device" copy renamed to "Tool"

Backend contract (separate, user-owned): expose lifecycle fields on ToolRead / accept maintenance fields on ToolCreate+ToolUpdate — see docs/superpowers/specs/2026-07-03-qa-round4-mobile-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Report deferred items** (in the PR/summary): social logins (blocked on backend branch deploy), history export + history-500 (backend), return photo/condition capture, purchase/insurance UI, temporary access, web-portal QA list.
