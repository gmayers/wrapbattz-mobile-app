# Office-Worker Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic dashboard for `office_worker` role with a two-tab Where/Team screen, ship reusable card components (`LocationCard`, `MemberCard`, `ToolCard`), and add drill-down screens for location detail (Users|Tools tabs) and team-member detail.

**Architecture:** Custom 2-button segmented control swaps tab content via React state — no new navigation deps. New `OfficeWorker/` subdirectory under `Dashboard/` holds the parent screen, two tab modules, and two data hooks. Reusable cards live in `Dashboard/shared/components/` so detail screens (`LocationDetail`, `TeamMemberDetail`, standalone `TeamRoster`) consume the same components. All API calls go through existing endpoint modules (`sites`, `vans`, `members`, `assignments`, `siteAssignments`, `joinRequests`); backend gaps render the `palette.placeholder` em-dash.

**Tech Stack:** React Native 0.81.5, Expo SDK 54, React Navigation v7 (`@react-navigation/stack`), TypeScript 5.x (`strict: false`), Jest + `@testing-library/react-native`, Ionicons, existing `palette.ts` tokens.

**Spec:** `docs/superpowers/specs/2026-05-06-office-worker-dashboard-design.md`

**Branch:** `feature/office-worker-dashboard` off `master`.

**Schema reference (verified during planning):**
- `MemberRead` has `id`, `user_id`, `email`, `first_name`, `last_name`, `role`, `is_active`, `is_primary`, `joined_at`. NO `assigned_site` field — per-member location must be derived from `siteAssignments`.
- `SiteRead` has `id`, `name`, `site_type`, `prefix_code`, `nickname`, `status` (+ address fields). `site_type` is the kind discriminator.
- `VanRead` has `id`, `name`, `prefix_code`, `nickname`, `status`. Vans are a separate entity from sites.
- `AssignmentRead` has `assignee_user_id`, `assignee_user_email` (no name), `assignee_site_id`, `assignee_site_name`, `tool_id`, `tool_name`, `status`. Tool-on-site is `assignee_site_id != null && status === 'active'`.
- `SiteAssignmentRead` has `user_id`, `user_email`, `site_id`, `site_name`, `role` (per-site role label). Used for "who is on this site" and "which site is this person at".
- `JoinRequestRead` is gated to admin/owner — office workers may 403; the hook catches and falls back to `pending: 0`.

---

## Task 1: Worktree + branch setup

**Files:** no code changes.

- [ ] **Step 1: Verify starting state**

```bash
cd /home/garan/Documents/programming/live-projects/wrapbattz2/app/wrapbattz
git status --short
git log -1 --format="%h %s"
```

Expected: HEAD is `3581e65 docs(spec): office-worker dashboard design` or later. Pre-existing untracked files (`assets/q-button.jpeg`, `q-button.jpeg`) and modified `MainTabBar.tsx` / `DashboardScreen.tsx` / `DashboardScreen.test.tsx` are unrelated work-in-progress — leave them alone.

- [ ] **Step 2: Create the worktree + feature branch**

```bash
git worktree add .worktrees/office-worker-dashboard -b feature/office-worker-dashboard master
cd .worktrees/office-worker-dashboard
git status -sb
```

Expected: `## feature/office-worker-dashboard` with no uncommitted changes. **All subsequent tasks run from this worktree directory.**

- [ ] **Step 3: No commit** — proceed to Task 2.

---

## Task 2: Pure helpers — initials + deterministic colour

**Files:**
- Create: `src/screens/Dashboard/shared/identity.ts`
- Test: `src/screens/Dashboard/shared/__tests__/identity.test.ts`

These two functions are used by `MemberCard` and elsewhere. Pure, no React.

- [ ] **Step 1: Write failing tests**

Create `src/screens/Dashboard/shared/__tests__/identity.test.ts`:

```ts
import { computeInitials, colourFromName } from '../identity';

describe('computeInitials', () => {
  it('uses first letter of each of first+last when both present', () => {
    expect(computeInitials('Wendy', 'Jones')).toBe('WJ');
  });
  it('uppercases the result', () => {
    expect(computeInitials('wendy', 'jones')).toBe('WJ');
  });
  it('falls back to first letter of first name when no last', () => {
    expect(computeInitials('Wendy', '')).toBe('W');
  });
  it('falls back to email first letter when no name parts', () => {
    expect(computeInitials('', '', 'sylvia@example.com')).toBe('S');
  });
  it('returns "?" when nothing is provided', () => {
    expect(computeInitials('', '', '')).toBe('?');
  });
  it('handles null/undefined inputs', () => {
    expect(computeInitials(null, undefined, null)).toBe('?');
  });
});

describe('colourFromName', () => {
  it('returns a hex string', () => {
    expect(colourFromName('Wendy Jones')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
  it('is deterministic for the same input', () => {
    expect(colourFromName('Wendy Jones')).toBe(colourFromName('Wendy Jones'));
  });
  it('returns different colours for different names', () => {
    const a = colourFromName('Wendy Jones');
    const b = colourFromName('Sylvia Williams');
    expect(a).not.toBe(b);
  });
  it('handles empty string without crashing', () => {
    expect(colourFromName('')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- src/screens/Dashboard/shared/__tests__/identity.test.ts
```

Expected: FAIL with "Cannot find module '../identity'".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/shared/identity.ts`:

```ts
const PALETTE = [
  '#F97316', // orange
  '#22C55E', // green
  '#58A6FF', // blue
  '#FFC72C', // amber
  '#A78BFA', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F85149', // red
];

export function computeInitials(
  first?: string | null,
  last?: string | null,
  email?: string | null,
): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f || l) {
    const a = f ? f[0] : '';
    const b = l ? l[0] : '';
    const out = (a + b).toUpperCase();
    return out || '?';
  }
  const e = (email ?? '').trim();
  return e ? e[0].toUpperCase() : '?';
}

export function colourFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test -- src/screens/Dashboard/shared/__tests__/identity.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/shared/identity.ts src/screens/Dashboard/shared/__tests__/identity.test.ts
git commit -m "feat(dashboard): add identity helpers (initials, colour-from-name)"
```

---

## Task 3: SegmentedTabs component

**Files:**
- Create: `src/screens/Dashboard/OfficeWorker/components/SegmentedTabs.tsx`
- Test: `src/screens/Dashboard/OfficeWorker/components/__tests__/SegmentedTabs.test.tsx`

Reusable 2-tab segmented control. Used by `OfficeWorkerDashboardScreen` (Where|Team) and `LocationDetailScreen` (Users|Tools).

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/OfficeWorker/components/__tests__/SegmentedTabs.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SegmentedTabs from '../SegmentedTabs';

describe('SegmentedTabs', () => {
  it('renders both labels', () => {
    render(<SegmentedTabs left="Where" right="Team" value="left" onChange={() => {}} />);
    expect(screen.getByText('Where')).toBeTruthy();
    expect(screen.getByText('Team')).toBeTruthy();
  });

  it('calls onChange("right") when right tab pressed', () => {
    const onChange = jest.fn();
    render(<SegmentedTabs left="Where" right="Team" value="left" onChange={onChange} />);
    fireEvent.press(screen.getByText('Team'));
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('marks the active tab as accessibilityState.selected', () => {
    render(<SegmentedTabs left="Where" right="Team" value="right" onChange={() => {}} />);
    const right = screen.getByLabelText('Team tab');
    expect(right.props.accessibilityState).toEqual({ selected: true });
    const left = screen.getByLabelText('Where tab');
    expect(left.props.accessibilityState).toEqual({ selected: false });
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/components/__tests__/SegmentedTabs.test.tsx
```

Expected: FAIL "Cannot find module '../SegmentedTabs'".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/OfficeWorker/components/SegmentedTabs.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { palette } from '../../shared/palette';

export type SegmentedValue = 'left' | 'right';

interface Props {
  left: string;
  right: string;
  value: SegmentedValue;
  onChange: (value: SegmentedValue) => void;
}

const SegmentedTabs: React.FC<Props> = ({ left, right, value, onChange }) => {
  return (
    <View style={styles.row}>
      <Tab label={left} active={value === 'left'} onPress={() => onChange('left')} />
      <Tab label={right} active={value === 'right'} onPress={() => onChange('right')} />
    </View>
  );
};

interface TabProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const Tab: React.FC<TabProps> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.tab, active && styles.tabActive]}
    onPress={onPress}
    accessibilityRole="tab"
    accessibilityLabel={`${label} tab`}
    accessibilityState={{ selected: active }}
    activeOpacity={0.85}
  >
    <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
  </TouchableOpacity>
);

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
  tabActive: {
    backgroundColor: palette.amber,
  },
  label: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: '#1B1300',
    fontWeight: '700',
  },
});

export default SegmentedTabs;
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/components/__tests__/SegmentedTabs.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/OfficeWorker/components/SegmentedTabs.tsx src/screens/Dashboard/OfficeWorker/components/__tests__/SegmentedTabs.test.tsx
git commit -m "feat(dashboard): add SegmentedTabs 2-button control"
```

---

## Task 4: FilterChips component

**Files:**
- Create: `src/screens/Dashboard/OfficeWorker/components/FilterChips.tsx`
- Test: `src/screens/Dashboard/OfficeWorker/components/__tests__/FilterChips.test.tsx`

Horizontal scroll row of chips with "All" default. Generic over chip key.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/OfficeWorker/components/__tests__/FilterChips.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import FilterChips from '../FilterChips';

const ITEMS = [
  { key: 'all', label: 'All' },
  { key: 'sites', label: 'Sites' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'toolboxes', label: 'Toolboxes' },
];

describe('FilterChips', () => {
  it('renders every label', () => {
    render(<FilterChips items={ITEMS} value="all" onChange={() => {}} />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Sites')).toBeTruthy();
    expect(screen.getByText('Vehicles')).toBeTruthy();
    expect(screen.getByText('Toolboxes')).toBeTruthy();
  });

  it('calls onChange with chip key on press', () => {
    const onChange = jest.fn();
    render(<FilterChips items={ITEMS} value="all" onChange={onChange} />);
    fireEvent.press(screen.getByText('Vehicles'));
    expect(onChange).toHaveBeenCalledWith('vehicles');
  });

  it('marks the active chip selected', () => {
    render(<FilterChips items={ITEMS} value="sites" onChange={() => {}} />);
    expect(screen.getByLabelText('Sites filter').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('All filter').props.accessibilityState).toEqual({ selected: false });
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/components/__tests__/FilterChips.test.tsx
```

Expected: FAIL "Cannot find module '../FilterChips'".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/OfficeWorker/components/FilterChips.tsx`:

```tsx
import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { palette } from '../../shared/palette';

export interface FilterChipItem<K extends string = string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  items: FilterChipItem<K>[];
  value: K;
  onChange: (key: K) => void;
}

function FilterChips<K extends string>({ items, value, onChange }: Props<K>) {
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
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(item.key)}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} filter`}
            accessibilityState={{ selected: active }}
            activeOpacity={0.85}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
      <View style={styles.endPad} />
    </ScrollView>
  );
}

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
  chipActive: {
    backgroundColor: palette.amberSoft,
    borderColor: palette.amber,
  },
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  labelActive: { color: palette.amber, fontWeight: '700' },
  endPad: { width: 4 },
});

export default FilterChips;
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/components/__tests__/FilterChips.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/OfficeWorker/components/FilterChips.tsx src/screens/Dashboard/OfficeWorker/components/__tests__/FilterChips.test.tsx
git commit -m "feat(dashboard): add FilterChips horizontal selector"
```

---

## Task 5: KindBadge + StatusPill + InitialsChipStack primitives

**Files:**
- Create: `src/screens/Dashboard/shared/components/KindBadge.tsx`
- Create: `src/screens/Dashboard/shared/components/StatusPill.tsx`
- Create: `src/screens/Dashboard/shared/components/InitialsChipStack.tsx`
- Test: `src/screens/Dashboard/shared/components/__tests__/KindBadge.test.tsx`
- Test: `src/screens/Dashboard/shared/components/__tests__/StatusPill.test.tsx`
- Test: `src/screens/Dashboard/shared/components/__tests__/InitialsChipStack.test.tsx`

Three small visual primitives composed into the cards. Build all three together.

- [ ] **Step 1: Write all three failing tests**

Create `src/screens/Dashboard/shared/components/__tests__/KindBadge.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import KindBadge from '../KindBadge';

describe('KindBadge', () => {
  it('renders SITE label and icon for kind=site', () => {
    render(<KindBadge kind="site" />);
    expect(screen.getByText('SITE')).toBeTruthy();
  });
  it('renders VEHICLE for kind=vehicle', () => {
    render(<KindBadge kind="vehicle" />);
    expect(screen.getByText('VEHICLE')).toBeTruthy();
  });
  it('renders TOOLBOX for kind=toolbox', () => {
    render(<KindBadge kind="toolbox" />);
    expect(screen.getByText('TOOLBOX')).toBeTruthy();
  });
});
```

Create `src/screens/Dashboard/shared/components/__tests__/StatusPill.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import StatusPill from '../StatusPill';

describe('StatusPill', () => {
  it('renders the label', () => {
    render(<StatusPill label="Active" tone="green" />);
    expect(screen.getByText('Active')).toBeTruthy();
  });
  it('does not render when label is empty', () => {
    const { toJSON } = render(<StatusPill label="" tone="green" />);
    expect(toJSON()).toBeNull();
  });
});
```

Create `src/screens/Dashboard/shared/components/__tests__/InitialsChipStack.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import InitialsChipStack from '../InitialsChipStack';

describe('InitialsChipStack', () => {
  it('renders up to 3 chips', () => {
    render(<InitialsChipStack initials={['MJ', 'SW', 'LG']} />);
    expect(screen.getByText('MJ')).toBeTruthy();
    expect(screen.getByText('SW')).toBeTruthy();
    expect(screen.getByText('LG')).toBeTruthy();
    expect(screen.queryByText('+')).toBeNull();
  });

  it('renders +N overflow when more than 3', () => {
    render(<InitialsChipStack initials={['MJ', 'SW', 'LG', 'DT', 'WJ']} />);
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('renders nothing when array empty', () => {
    const { toJSON } = render(<InitialsChipStack initials={[]} />);
    expect(toJSON()).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify all fail**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/
```

Expected: 3 FAIL — "Cannot find module" errors.

- [ ] **Step 3: Implement KindBadge**

Create `src/screens/Dashboard/shared/components/KindBadge.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../palette';

export type LocationKind = 'site' | 'vehicle' | 'toolbox';

interface Props {
  kind: LocationKind;
}

const ICON: Record<LocationKind, keyof typeof Ionicons.glyphMap> = {
  site: 'location-outline',
  vehicle: 'car-outline',
  toolbox: 'cube-outline',
};

const LABEL: Record<LocationKind, string> = {
  site: 'SITE',
  vehicle: 'VEHICLE',
  toolbox: 'TOOLBOX',
};

const KindBadge: React.FC<Props> = ({ kind }) => (
  <View style={styles.row}>
    <Ionicons name={ICON[kind]} size={11} color={palette.textMuted} />
    <Text style={styles.label}>{LABEL[kind]}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
});

export default KindBadge;
```

- [ ] **Step 4: Implement StatusPill**

Create `src/screens/Dashboard/shared/components/StatusPill.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../palette';

export type StatusTone = 'green' | 'amber' | 'red' | 'muted';

interface Props {
  label: string;
  tone: StatusTone;
}

const StatusPill: React.FC<Props> = ({ label, tone }) => {
  if (!label) return null;
  const palette_ = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette_.bg }]}>
      <Text style={[styles.label, { color: palette_.fg }]}>{label}</Text>
    </View>
  );
};

const TONES: Record<StatusTone, { fg: string; bg: string }> = {
  green: { fg: palette.green, bg: 'rgba(34, 197, 94, 0.14)' },
  amber: { fg: palette.amber, bg: palette.amberSoft },
  red: { fg: palette.red, bg: palette.redSoft },
  muted: { fg: palette.textMuted, bg: palette.card },
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});

export default StatusPill;
```

- [ ] **Step 5: Implement InitialsChipStack**

Create `src/screens/Dashboard/shared/components/InitialsChipStack.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../palette';
import { colourFromName } from '../identity';

interface Props {
  initials: string[];
  max?: number;
}

const InitialsChipStack: React.FC<Props> = ({ initials, max = 3 }) => {
  if (initials.length === 0) return null;
  const visible = initials.slice(0, max);
  const overflow = initials.length - visible.length;
  return (
    <View style={styles.row}>
      {visible.map((init, idx) => (
        <View
          key={`${init}-${idx}`}
          style={[
            styles.chip,
            { backgroundColor: colourFromName(init), marginLeft: idx === 0 ? 0 : -8 },
          ]}
        >
          <Text style={styles.text}>{init}</Text>
        </View>
      ))}
      {overflow > 0 ? (
        <View style={[styles.chip, styles.overflow, { marginLeft: -8 }]}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.card,
  },
  text: { color: '#1B1300', fontSize: 10, fontWeight: '800' },
  overflow: { backgroundColor: palette.placeholder },
  overflowText: { color: palette.textPrimary, fontSize: 10, fontWeight: '700' },
});

export default InitialsChipStack;
```

- [ ] **Step 6: Run all three — verify they pass**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/
```

Expected: PASS, 8 tests across 3 files.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Dashboard/shared/components/KindBadge.tsx src/screens/Dashboard/shared/components/StatusPill.tsx src/screens/Dashboard/shared/components/InitialsChipStack.tsx src/screens/Dashboard/shared/components/__tests__/
git commit -m "feat(dashboard): add KindBadge, StatusPill, InitialsChipStack primitives"
```

---

## Task 6: LocationCard component

**Files:**
- Create: `src/screens/Dashboard/shared/components/LocationCard.tsx`
- Test: `src/screens/Dashboard/shared/components/__tests__/LocationCard.test.tsx`

Half-width grid card shown in the Where tab. Uses `KindBadge` + `InitialsChipStack`.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/shared/components/__tests__/LocationCard.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LocationCard from '../LocationCard';

describe('LocationCard', () => {
  const baseProps = {
    kind: 'site' as const,
    name: 'Chelsea Wharf',
    code: 'CHW-04',
    toolCount: 8,
    workerInitials: ['MJ', 'SW', 'LG'],
    onPress: jest.fn(),
  };

  beforeEach(() => baseProps.onPress.mockClear());

  it('renders name, code, count and kind', () => {
    render(<LocationCard {...baseProps} />);
    expect(screen.getByText('Chelsea Wharf')).toBeTruthy();
    expect(screen.getByText('CHW-04')).toBeTruthy();
    expect(screen.getByText('8 tools')).toBeTruthy();
    expect(screen.getByText('SITE')).toBeTruthy();
  });

  it('pluralises tool/tools correctly', () => {
    render(<LocationCard {...baseProps} toolCount={1} />);
    expect(screen.getByText('1 tool')).toBeTruthy();
  });

  it('calls onPress', () => {
    render(<LocationCard {...baseProps} />);
    fireEvent.press(screen.getByLabelText('Chelsea Wharf, 8 tools'));
    expect(baseProps.onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/LocationCard.test.tsx
```

Expected: FAIL "Cannot find module '../LocationCard'".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/shared/components/LocationCard.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { palette } from '../palette';
import KindBadge, { LocationKind } from './KindBadge';
import InitialsChipStack from './InitialsChipStack';

interface Props {
  kind: LocationKind;
  name: string;
  code: string;
  toolCount: number;
  workerInitials: string[];
  hasUnread?: boolean;
  onPress: () => void;
}

const LocationCard: React.FC<Props> = ({
  kind,
  name,
  code,
  toolCount,
  workerInitials,
  hasUnread,
  onPress,
}) => {
  const toolsLabel = `${toolCount} ${toolCount === 1 ? 'tool' : 'tools'}`;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${toolsLabel}`}
      activeOpacity={0.85}
    >
      <View style={styles.topRow}>
        <KindBadge kind={kind} />
        {hasUnread ? <View style={styles.dot} /> : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.code} numberOfLines={1}>
        {code}
      </Text>
      <View style={styles.bottomRow}>
        <Text style={styles.count}>{toolsLabel}</Text>
        <InitialsChipStack initials={workerInitials} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
    minHeight: 140,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.green,
  },
  name: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  code: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LocationCard;
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/LocationCard.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/shared/components/LocationCard.tsx src/screens/Dashboard/shared/components/__tests__/LocationCard.test.tsx
git commit -m "feat(dashboard): add LocationCard"
```

---

## Task 7: MemberCard component

**Files:**
- Create: `src/screens/Dashboard/shared/components/MemberCard.tsx`
- Test: `src/screens/Dashboard/shared/components/__tests__/MemberCard.test.tsx`

Full-width row card shown in the Team tab and the LocationDetail Users tab. Uses `colourFromName`.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/shared/components/__tests__/MemberCard.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MemberCard from '../MemberCard';

describe('MemberCard', () => {
  const baseProps = {
    initials: 'WJ',
    name: 'Wendy Jones',
    metaPrimary: 'CHW-04 · Site lead',
    metaSecondary: 'Last scan 08:12',
    toolCount: 3,
    onViewPress: jest.fn(),
  };

  beforeEach(() => baseProps.onViewPress.mockClear());

  it('renders name, meta, count and View button', () => {
    render(<MemberCard {...baseProps} />);
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
    expect(screen.getByText('CHW-04 · Site lead')).toBeTruthy();
    expect(screen.getByText('Last scan 08:12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('View')).toBeTruthy();
  });

  it('omits metaSecondary line when undefined', () => {
    render(<MemberCard {...baseProps} metaSecondary={undefined} />);
    expect(screen.queryByText('Last scan 08:12')).toBeNull();
  });

  it('hides View button when onViewPress is undefined', () => {
    const { onViewPress, ...rest } = baseProps;
    render(<MemberCard {...rest} />);
    expect(screen.queryByText('View')).toBeNull();
  });

  it('calls onViewPress when View pressed', () => {
    render(<MemberCard {...baseProps} />);
    fireEvent.press(screen.getByText('View'));
    expect(baseProps.onViewPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/MemberCard.test.tsx
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/shared/components/MemberCard.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { palette } from '../palette';
import { colourFromName } from '../identity';

interface Props {
  initials: string;
  initialsBg?: string;
  name: string;
  metaPrimary: string;
  metaSecondary?: string;
  toolCount: number;
  onViewPress?: () => void;
  presence?: 'online' | 'offline' | null;
}

const MemberCard: React.FC<Props> = ({
  initials,
  initialsBg,
  name,
  metaPrimary,
  metaSecondary,
  toolCount,
  onViewPress,
  presence,
}) => {
  const bg = initialsBg ?? colourFromName(name);
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text style={styles.avatarText}>{initials}</Text>
        {presence ? (
          <View style={[styles.presence, presence === 'online' ? styles.online : styles.offline]} />
        ) : null}
      </View>
      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.metaPrimary} numberOfLines={1}>
          {metaPrimary}
        </Text>
        {metaSecondary ? (
          <Text style={styles.metaSecondary} numberOfLines={1}>
            {metaSecondary}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.count}>{toolCount}</Text>
        <Text style={styles.countLabel}>{toolCount === 1 ? 'tool' : 'tools'}</Text>
      </View>
      {onViewPress ? (
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={onViewPress}
          accessibilityRole="button"
          accessibilityLabel={`View ${name}`}
          activeOpacity={0.85}
        >
          <Text style={styles.viewText}>View</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#1B1300',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  presence: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.background,
  },
  online: { backgroundColor: palette.green },
  offline: { backgroundColor: palette.red },
  middle: { flex: 1 },
  name: { color: palette.textPrimary, fontSize: 15, fontWeight: '700' },
  metaPrimary: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  metaSecondary: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
  right: { alignItems: 'center', minWidth: 40 },
  count: { color: palette.textPrimary, fontSize: 18, fontWeight: '700' },
  countLabel: { color: palette.textMuted, fontSize: 10 },
  viewBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewText: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
});

export default MemberCard;
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/MemberCard.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/shared/components/MemberCard.tsx src/screens/Dashboard/shared/components/__tests__/MemberCard.test.tsx
git commit -m "feat(dashboard): add MemberCard"
```

---

## Task 8: ToolCard component

**Files:**
- Create: `src/screens/Dashboard/shared/components/ToolCard.tsx`
- Test: `src/screens/Dashboard/shared/components/__tests__/ToolCard.test.tsx`

Full-width row card shown in the Tools tab on detail screens.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/shared/components/__tests__/ToolCard.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ToolCard from '../ToolCard';

describe('ToolCard', () => {
  const baseProps = {
    name: 'DeWalt Impact Driver',
    identifier: 'DCF887',
    onPress: jest.fn(),
  };
  beforeEach(() => baseProps.onPress.mockClear());

  it('renders name and identifier', () => {
    render(<ToolCard {...baseProps} />);
    expect(screen.getByText('DeWalt Impact Driver')).toBeTruthy();
    expect(screen.getByText('DCF887')).toBeTruthy();
  });

  it('renders status pill when provided', () => {
    render(<ToolCard {...baseProps} status="Active" />);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders assignee row when provided', () => {
    render(<ToolCard {...baseProps} assigneeName="Wendy Jones" />);
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
  });

  it('omits assignee row when not provided', () => {
    render(<ToolCard {...baseProps} />);
    expect(screen.queryByText(/Wendy Jones/)).toBeNull();
  });

  it('calls onPress', () => {
    render(<ToolCard {...baseProps} />);
    fireEvent.press(screen.getByLabelText('DeWalt Impact Driver'));
    expect(baseProps.onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/ToolCard.test.tsx
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/shared/components/ToolCard.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../palette';
import StatusPill, { StatusTone } from './StatusPill';

interface Props {
  name: string;
  identifier: string;
  status?: string;
  assigneeName?: string;
  onPress: () => void;
}

function statusTone(s?: string): StatusTone {
  if (!s) return 'muted';
  const lower = s.toLowerCase();
  if (lower === 'active') return 'green';
  if (lower === 'maintenance' || lower === 'maintenance_due') return 'amber';
  if (lower === 'missing' || lower === 'lost' || lower === 'stolen') return 'red';
  return 'muted';
}

const ToolCard: React.FC<Props> = ({ name, identifier, status, assigneeName, onPress }) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={name}
    activeOpacity={0.85}
  >
    <View style={styles.iconWrap}>
      <Ionicons name="construct-outline" size={20} color={palette.textSecondary} />
    </View>
    <View style={styles.middle}>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <Text style={styles.id} numberOfLines={1}>{identifier}</Text>
      {assigneeName ? (
        <Text style={styles.assignee} numberOfLines={1}>Assigned to {assigneeName}</Text>
      ) : null}
    </View>
    <View style={styles.right}>
      {status ? <StatusPill label={status} tone={statusTone(status)} /> : null}
      <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
    </View>
  </TouchableOpacity>
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
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1 },
  name: { color: palette.textPrimary, fontSize: 14, fontWeight: '700' },
  id: { color: palette.textMuted, fontSize: 12, marginTop: 2 },
  assignee: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export default ToolCard;
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/Dashboard/shared/components/__tests__/ToolCard.test.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/shared/components/ToolCard.tsx src/screens/Dashboard/shared/components/__tests__/ToolCard.test.tsx
git commit -m "feat(dashboard): add ToolCard"
```

---

## Task 9: useOfficeWorkerWhereData hook

**Files:**
- Create: `src/screens/Dashboard/OfficeWorker/types.ts`
- Create: `src/screens/Dashboard/OfficeWorker/hooks/useOfficeWorkerWhereData.ts`
- Test: `src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerWhereData.test.ts`

Loads sites + vans + active assignments, derives per-location tool counts, worker initials, and BACKEND_GAP placeholders for approvals/returns.

- [ ] **Step 1: Define shared types**

Create `src/screens/Dashboard/OfficeWorker/types.ts`:

```ts
import type { LocationKind } from '../shared/components/KindBadge';

export interface LocationItem {
  id: number;
  kind: LocationKind;
  name: string;
  code: string;
  toolCount: number;
  workerInitials: string[];
}

export interface WhereData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;
  organizationName: string;
  userInitials: string;
  hasUnreadAlerts: boolean | null;
  counts: { sites: number; vehicles: number; toolboxes: number; total: number };
  totalToolsPlaced: number;
  locations: LocationItem[];
  pendingApprovals: number | null;
  returnsDue: number | null;
}

export interface MemberRow {
  memberId: number;
  initials: string;
  name: string;
  metaPrimary: string;
  metaSecondary?: string;
  toolCount: number;
}

export interface TeamData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;
  organizationName: string;
  userInitials: string;
  hasUnreadAlerts: boolean | null;
  totalMembers: number;
  totalToolsOut: number;
  onSite: number | null;
  hq: number | null;
  members: MemberRow[];
}
```

- [ ] **Step 2: Write failing test**

Create `src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerWhereData.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useOfficeWorkerWhereData } from '../useOfficeWorkerWhereData';

const mockListSites = jest.fn();
const mockListVans = jest.fn();
const mockListAssignments = jest.fn();
const mockListJoinRequests = jest.fn();
const mockGetMyOrg = jest.fn();

jest.mock('../../../../../api/endpoints', () => ({
  sites: { listSites: (...args: any[]) => mockListSites(...args) },
  vans: { listVans: (...args: any[]) => mockListVans(...args) },
  assignments: { listAssignments: (...args: any[]) => mockListAssignments(...args) },
  joinRequests: { listJoinRequests: (...args: any[]) => mockListJoinRequests(...args) },
  organizations: { getMyOrganization: (...args: any[]) => mockGetMyOrg(...args) },
}));

jest.mock('../../../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { first_name: 'Mary', last_name: 'Beth', email: 'mb@example.com' } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyOrg.mockResolvedValue({ name: 'Davidson-Morris' });
  mockListSites.mockResolvedValue({
    items: [
      { id: 1, name: 'Chelsea Wharf', site_type: 'site', prefix_code: 'CHW-04' },
      { id: 2, name: 'Canary Block C', site_type: 'site', prefix_code: 'CBC-11' },
      { id: 3, name: 'Toolbox A (HQ)', site_type: 'toolbox', prefix_code: 'TB-A' },
    ],
    total: 3, page: 1, page_size: 50, total_pages: 1,
  });
  mockListVans.mockResolvedValue({
    items: [
      { id: 10, name: 'Transit Van 02', prefix_code: 'VAN-02' },
    ],
    total: 1, page: 1, page_size: 50, total_pages: 1,
  });
  mockListAssignments.mockResolvedValue({
    items: [
      { id: 100, tool_id: 1, tool_name: 'Drill', status: 'active', assignee_site_id: 1, assignee_site_name: 'CHW', assignee_user_id: 200, assignee_user_email: 'mj@x.com' },
      { id: 101, tool_id: 2, tool_name: 'Saw',   status: 'active', assignee_site_id: 1, assignee_site_name: 'CHW', assignee_user_id: 201, assignee_user_email: 'sw@x.com' },
      { id: 102, tool_id: 3, tool_name: 'Hammer',status: 'active', assignee_site_id: 3, assignee_site_name: 'TB',  assignee_user_id: null, assignee_user_email: '' },
    ],
    total: 3, page: 1, page_size: 50, total_pages: 1,
  });
  mockListJoinRequests.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
});

describe('useOfficeWorkerWhereData', () => {
  it('returns counts split by site_type and van entity', async () => {
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.counts).toEqual({ sites: 2, vehicles: 1, toolboxes: 1, total: 4 });
  });

  it('aggregates tool counts per location', async () => {
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const chelsea = result.current.locations.find(l => l.name === 'Chelsea Wharf');
    expect(chelsea?.toolCount).toBe(2);
    const tb = result.current.locations.find(l => l.name === 'Toolbox A (HQ)');
    expect(tb?.toolCount).toBe(1);
  });

  it('reports total tools placed across all assignments to a site', async () => {
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalToolsPlaced).toBe(3);
  });

  it('falls back to pendingApprovals=null when join-requests endpoint forbids', async () => {
    mockListJoinRequests.mockRejectedValueOnce(new Error('403'));
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pendingApprovals).toBeNull();
  });

  it('returnsDue is always null (BACKEND_GAP)', async () => {
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.returnsDue).toBeNull();
  });

  it('captures error when sites endpoint throws', async () => {
    mockListSites.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('boom');
  });
});
```

- [ ] **Step 3: Run — verify it fails**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerWhereData.test.ts
```

Expected: FAIL "Cannot find module".

- [ ] **Step 4: Implement**

Create `src/screens/Dashboard/OfficeWorker/hooks/useOfficeWorkerWhereData.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  sites as sitesApi,
  vans as vansApi,
  assignments as assignmentsApi,
  joinRequests as joinRequestsApi,
  organizations as organizationsApi,
} from '../../../../api/endpoints';
import type {
  AssignmentRead,
  OrganizationRead,
  SiteRead,
  VanRead,
} from '../../../../api/types';
import { useAuth } from '../../../../context/AuthContext';
import { computeInitials } from '../../shared/identity';
import type { LocationItem, WhereData } from '../types';

const TOOLBOX_TYPES = new Set(['toolbox', 'TOOLBOX']);

interface RawData {
  org: OrganizationRead | null;
  sites: SiteRead[];
  vans: VanRead[];
  activeAssignments: AssignmentRead[];
  pendingApprovals: number | null;
}

const EMPTY: RawData = {
  org: null,
  sites: [],
  vans: [],
  activeAssignments: [],
  pendingApprovals: null,
};

export function useOfficeWorkerWhereData(): WhereData {
  const { userData } = useAuth();
  const [raw, setRaw] = useState<RawData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [org, sitesPage, vansPage, assignmentsPage, joinRequestsPage] = await Promise.all([
        organizationsApi.getMyOrganization().catch(() => null),
        sitesApi.listSites(),
        vansApi.listVans(),
        assignmentsApi.listAssignments({ status: 'active' }),
        joinRequestsApi.listJoinRequests().catch(() => null),
      ]);
      setRaw({
        org,
        sites: sitesPage.items,
        vans: vansPage.items,
        activeAssignments: assignmentsPage.items,
        pendingApprovals: joinRequestsPage ? (joinRequestsPage.total ?? joinRequestsPage.items.length) : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<WhereData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const orgName = (raw.org?.name ?? userData?.organization?.name ?? '').toUpperCase();
    const userInitials = computeInitials(
      userData?.first_name,
      userData?.last_name,
      userData?.email,
    );

    const toolboxes = raw.sites.filter((s) => TOOLBOX_TYPES.has(s.site_type)).length;
    const sites = raw.sites.length - toolboxes;
    const vehicles = raw.vans.length;

    const byEmail = new Map<string, string>();
    for (const a of raw.activeAssignments) {
      const email = a.assignee_user_email || '';
      if (email && !byEmail.has(email)) {
        byEmail.set(email, computeInitials('', '', email));
      }
    }

    const siteToolCount = new Map<number, number>();
    const siteWorkerEmails = new Map<number, Set<string>>();
    const vanToolCount = new Map<number, number>();
    const vanWorkerEmails = new Map<number, Set<string>>();

    for (const a of raw.activeAssignments) {
      if (a.assignee_site_id == null) continue;
      const siteId = a.assignee_site_id;
      siteToolCount.set(siteId, (siteToolCount.get(siteId) ?? 0) + 1);
      if (a.assignee_user_email) {
        const set = siteWorkerEmails.get(siteId) ?? new Set();
        set.add(a.assignee_user_email);
        siteWorkerEmails.set(siteId, set);
      }
    }

    const locationsFromSites: LocationItem[] = raw.sites.map((s) => {
      const isToolbox = TOOLBOX_TYPES.has(s.site_type);
      const emails = siteWorkerEmails.get(s.id);
      const initials = emails ? Array.from(emails).map((e) => byEmail.get(e) ?? '?') : [];
      return {
        id: s.id,
        kind: isToolbox ? 'toolbox' : 'site',
        name: s.name,
        code: s.prefix_code || s.nickname || '',
        toolCount: siteToolCount.get(s.id) ?? 0,
        workerInitials: initials,
      };
    });

    // BACKEND_GAP: tools assigned to vans are not currently joined into
    // listAssignmentsBySite. Show 0 until vans gain a list-assignments path.
    const locationsFromVans: LocationItem[] = raw.vans.map((v) => ({
      id: v.id,
      kind: 'vehicle',
      name: v.name,
      code: v.prefix_code || v.nickname || '',
      toolCount: vanToolCount.get(v.id) ?? 0,
      workerInitials: Array.from(vanWorkerEmails.get(v.id) ?? []).map((e) => byEmail.get(e) ?? '?'),
    }));

    const locations = [...locationsFromSites, ...locationsFromVans];
    const totalToolsPlaced = raw.activeAssignments.filter((a) => a.assignee_site_id != null).length;

    return {
      organizationName: orgName,
      userInitials,
      hasUnreadAlerts: null,
      counts: { sites, vehicles, toolboxes, total: raw.sites.length + raw.vans.length },
      totalToolsPlaced,
      locations,
      pendingApprovals: raw.pendingApprovals,
      returnsDue: null,
    };
  }, [raw, userData]);

  return { ...data, isLoading, error, refresh: load };
}
```

- [ ] **Step 5: Run — verify it passes**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerWhereData.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Dashboard/OfficeWorker/types.ts src/screens/Dashboard/OfficeWorker/hooks/useOfficeWorkerWhereData.ts src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerWhereData.test.ts
git commit -m "feat(dashboard): add useOfficeWorkerWhereData hook"
```

---

## Task 10: useOfficeWorkerTeamData hook

**Files:**
- Create: `src/screens/Dashboard/OfficeWorker/hooks/useOfficeWorkerTeamData.ts`
- Test: `src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerTeamData.test.ts`

Loads members + active assignments + site assignments, groups assignments client-side by `assignee_user_id` to compute per-member tool counts.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerTeamData.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useOfficeWorkerTeamData } from '../useOfficeWorkerTeamData';

const mockListMembers = jest.fn();
const mockListAssignments = jest.fn();
const mockListSiteAssignments = jest.fn();
const mockGetMyOrg = jest.fn();

jest.mock('../../../../../api/endpoints', () => ({
  members: { listMembers: (...args: any[]) => mockListMembers(...args) },
  assignments: { listAssignments: (...args: any[]) => mockListAssignments(...args) },
  siteAssignments: { listSiteAssignments: (...args: any[]) => mockListSiteAssignments(...args) },
  organizations: { getMyOrganization: (...args: any[]) => mockGetMyOrg(...args) },
}));

jest.mock('../../../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { first_name: 'Mary', last_name: 'Beth', email: 'mb@example.com' } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyOrg.mockResolvedValue({ name: 'Davidson-Morris' });
  mockListMembers.mockResolvedValue({
    items: [
      { id: 1, user_id: 200, first_name: 'Wendy',  last_name: 'Jones',    email: 'wj@x.com', role: 'office_worker', is_active: true, is_primary: false, joined_at: '' },
      { id: 2, user_id: 201, first_name: 'Sylvia', last_name: 'Williams', email: 'sw@x.com', role: 'site_worker',   is_active: true, is_primary: false, joined_at: '' },
      { id: 3, user_id: 202, first_name: 'Lydia',  last_name: 'Graham',   email: 'lg@x.com', role: 'site_worker',   is_active: true, is_primary: false, joined_at: '' },
      { id: 4, user_id: 203, first_name: 'Denise', last_name: 'Thomas',   email: 'dt@x.com', role: 'site_worker',   is_active: true, is_primary: false, joined_at: '' },
    ],
    total: 4, page: 1, page_size: 50, total_pages: 1,
  });
  mockListAssignments.mockResolvedValue({
    items: [
      { id: 1, tool_id: 1, tool_name: 'Drill', status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 2, tool_id: 2, tool_name: 'Saw',   status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 3, tool_id: 3, tool_name: 'Hammer',status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 4, tool_id: 4, tool_name: 'Wrench',status: 'active', assignee_user_id: 201, assignee_user_email: 'sw@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 5, tool_id: 5, tool_name: 'Pliers',status: 'active', assignee_user_id: 201, assignee_user_email: 'sw@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 6, tool_id: 6, tool_name: 'Tape',  status: 'active', assignee_user_id: 202, assignee_user_email: 'lg@x.com', assignee_site_id: 2, assignee_site_name: 'CBC' },
      { id: 7, tool_id: 7, tool_name: 'Knife', status: 'active', assignee_user_id: 203, assignee_user_email: 'dt@x.com', assignee_site_id: null, assignee_site_name: '' },
      { id: 8, tool_id: 8, tool_name: 'Scrap', status: 'active', assignee_user_id: 203, assignee_user_email: 'dt@x.com', assignee_site_id: null, assignee_site_name: '' },
    ],
    total: 8, page: 1, page_size: 50, total_pages: 1,
  });
  mockListSiteAssignments.mockResolvedValue({
    items: [
      { id: 10, user_id: 200, user_email: 'wj@x.com', site_id: 1, site_name: 'Chelsea Wharf', role: 'Site lead',   is_active: true, created_at: '' },
      { id: 11, user_id: 201, user_email: 'sw@x.com', site_id: 1, site_name: 'Chelsea Wharf', role: 'Foreman',     is_active: true, created_at: '' },
      { id: 12, user_id: 202, user_email: 'lg@x.com', site_id: 2, site_name: 'Canary Block',  role: 'Site worker', is_active: true, created_at: '' },
    ],
    total: 3, page: 1, page_size: 50, total_pages: 1,
  });
});

describe('useOfficeWorkerTeamData', () => {
  it('returns one member row per member', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members).toHaveLength(4);
    expect(result.current.totalMembers).toBe(4);
  });

  it('groups active assignments per member into toolCount', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const wendy = result.current.members.find(m => m.name === 'Wendy Jones');
    expect(wendy?.toolCount).toBe(3);
    const denise = result.current.members.find(m => m.name === 'Denise Thomas');
    expect(denise?.toolCount).toBe(2);
  });

  it('totalToolsOut equals total active assignments', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalToolsOut).toBe(8);
  });

  it('joins site role + site code into metaPrimary', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const wendy = result.current.members.find(m => m.name === 'Wendy Jones');
    expect(wendy?.metaPrimary).toBe('Chelsea Wharf · Site lead');
    const denise = result.current.members.find(m => m.name === 'Denise Thomas');
    expect(denise?.metaPrimary).toBe('Office worker');
  });

  it('omits metaSecondary (BACKEND_GAP for last-scan)', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members[0].metaSecondary).toBeUndefined();
  });

  it('onSite/hq are null (BACKEND_GAP)', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.onSite).toBeNull();
    expect(result.current.hq).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerTeamData.test.ts
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/OfficeWorker/hooks/useOfficeWorkerTeamData.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  members as membersApi,
  assignments as assignmentsApi,
  siteAssignments as siteAssignmentsApi,
  organizations as organizationsApi,
} from '../../../../api/endpoints';
import type {
  AssignmentRead,
  MemberRead,
  OrganizationRead,
  SiteAssignmentRead,
} from '../../../../api/types';
import { useAuth } from '../../../../context/AuthContext';
import { computeInitials } from '../../shared/identity';
import type { MemberRow, TeamData } from '../types';

interface RawData {
  org: OrganizationRead | null;
  members: MemberRead[];
  activeAssignments: AssignmentRead[];
  siteAssignments: SiteAssignmentRead[];
}

const EMPTY: RawData = { org: null, members: [], activeAssignments: [], siteAssignments: [] };

const ROLE_LABEL: Record<string, string> = {
  office_worker: 'Office worker',
  site_worker: 'Site worker',
  admin: 'Admin',
  owner: 'Owner',
};

function humanRole(role: string): string {
  return ROLE_LABEL[role] ?? role.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function useOfficeWorkerTeamData(): TeamData {
  const { userData } = useAuth();
  const [raw, setRaw] = useState<RawData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [org, membersPage, activePage, siteAssignmentsPage] = await Promise.all([
        organizationsApi.getMyOrganization().catch(() => null),
        membersApi.listMembers(),
        assignmentsApi.listAssignments({ status: 'active' }),
        siteAssignmentsApi.listSiteAssignments().catch(() => ({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 })),
      ]);
      setRaw({
        org,
        members: membersPage.items,
        activeAssignments: activePage.items,
        siteAssignments: siteAssignmentsPage.items,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<TeamData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const orgName = (raw.org?.name ?? userData?.organization?.name ?? '').toUpperCase();
    const userInitials = computeInitials(userData?.first_name, userData?.last_name, userData?.email);

    const toolCountByUser = new Map<number, number>();
    for (const a of raw.activeAssignments) {
      if (a.assignee_user_id == null) continue;
      toolCountByUser.set(a.assignee_user_id, (toolCountByUser.get(a.assignee_user_id) ?? 0) + 1);
    }

    const siteAssignmentByUser = new Map<number, SiteAssignmentRead>();
    for (const sa of raw.siteAssignments) {
      if (!sa.is_active) continue;
      const existing = siteAssignmentByUser.get(sa.user_id);
      if (!existing) siteAssignmentByUser.set(sa.user_id, sa);
    }

    const members: MemberRow[] = raw.members.map((m) => {
      const sa = siteAssignmentByUser.get(m.user_id);
      const fullName = `${m.first_name} ${m.last_name}`.trim() || m.email;
      const metaPrimary = sa
        ? `${sa.site_name}${sa.role ? ` · ${sa.role}` : ''}`
        : humanRole(m.role);
      return {
        memberId: m.user_id,
        initials: computeInitials(m.first_name, m.last_name, m.email),
        name: fullName,
        metaPrimary,
        metaSecondary: undefined, // BACKEND_GAP: no last-scan timestamp
        toolCount: toolCountByUser.get(m.user_id) ?? 0,
      };
    });

    return {
      organizationName: orgName,
      userInitials,
      hasUnreadAlerts: null,
      totalMembers: raw.members.length,
      totalToolsOut: raw.activeAssignments.length,
      onSite: null,    // BACKEND_GAP: no presence
      hq: null,        // BACKEND_GAP: no presence
      members,
    };
  }, [raw, userData]);

  return { ...data, isLoading, error, refresh: load };
}
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerTeamData.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/OfficeWorker/hooks/useOfficeWorkerTeamData.ts src/screens/Dashboard/OfficeWorker/hooks/__tests__/useOfficeWorkerTeamData.test.ts
git commit -m "feat(dashboard): add useOfficeWorkerTeamData hook"
```

---

## Task 11: ApprovalsBanner + StatsRow components

**Files:**
- Create: `src/screens/Dashboard/OfficeWorker/components/ApprovalsBanner.tsx`
- Create: `src/screens/Dashboard/OfficeWorker/components/StatsRow.tsx`
- Test: `src/screens/Dashboard/OfficeWorker/components/__tests__/ApprovalsBanner.test.tsx`
- Test: `src/screens/Dashboard/OfficeWorker/components/__tests__/StatsRow.test.tsx`

Two small composition components used by the tabs.

- [ ] **Step 1: Write failing tests**

Create `src/screens/Dashboard/OfficeWorker/components/__tests__/ApprovalsBanner.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ApprovalsBanner from '../ApprovalsBanner';

describe('ApprovalsBanner', () => {
  it('renders nothing when both pending and returns are null', () => {
    const { toJSON } = render(<ApprovalsBanner pendingApprovals={null} returnsDue={null} onReview={() => {}} />);
    expect(toJSON()).toBeNull();
  });
  it('renders pending count when present', () => {
    render(<ApprovalsBanner pendingApprovals={3} returnsDue={null} onReview={() => {}} />);
    expect(screen.getByText(/3 pending approvals/)).toBeTruthy();
  });
  it('renders returns-due count when present', () => {
    render(<ApprovalsBanner pendingApprovals={null} returnsDue={2} onReview={() => {}} />);
    expect(screen.getByText(/2 returns due/)).toBeTruthy();
  });
  it('joins both with separator when both present', () => {
    render(<ApprovalsBanner pendingApprovals={3} returnsDue={2} onReview={() => {}} />);
    expect(screen.getByText('3 pending approvals · 2 returns due')).toBeTruthy();
  });
  it('calls onReview when Review pressed', () => {
    const onReview = jest.fn();
    render(<ApprovalsBanner pendingApprovals={3} returnsDue={null} onReview={onReview} />);
    fireEvent.press(screen.getByText(/Review/));
    expect(onReview).toHaveBeenCalled();
  });
});
```

Create `src/screens/Dashboard/OfficeWorker/components/__tests__/StatsRow.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import StatsRow from '../StatsRow';

describe('StatsRow', () => {
  it('renders three stat blocks', () => {
    render(<StatsRow stats={[
      { label: 'ON SITE', value: 3 },
      { label: 'HQ',      value: 1 },
      { label: 'TOOLS OUT', value: 8 },
    ]} />);
    expect(screen.getByText('ON SITE')).toBeTruthy();
    expect(screen.getByText('HQ')).toBeTruthy();
    expect(screen.getByText('TOOLS OUT')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });
  it('renders em-dash for null values', () => {
    render(<StatsRow stats={[{ label: 'ON SITE', value: null }]} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify they fail**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/components/__tests__/ApprovalsBanner.test.tsx src/screens/Dashboard/OfficeWorker/components/__tests__/StatsRow.test.tsx
```

Expected: 2 FAIL "Cannot find module".

- [ ] **Step 3: Implement ApprovalsBanner**

Create `src/screens/Dashboard/OfficeWorker/components/ApprovalsBanner.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../shared/palette';

interface Props {
  pendingApprovals: number | null;
  returnsDue: number | null;
  onReview: () => void;
}

const ApprovalsBanner: React.FC<Props> = ({ pendingApprovals, returnsDue, onReview }) => {
  const parts: string[] = [];
  if (pendingApprovals != null) {
    parts.push(`${pendingApprovals} pending approval${pendingApprovals === 1 ? '' : 's'}`);
  }
  if (returnsDue != null) {
    parts.push(`${returnsDue} return${returnsDue === 1 ? '' : 's'} due`);
  }
  if (parts.length === 0) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle-outline" size={18} color={palette.amber} />
      <Text style={styles.text}>{parts.join(' · ')}</Text>
      <TouchableOpacity onPress={onReview} accessibilityRole="button" accessibilityLabel="Review approvals">
        <Text style={styles.action}>Review →</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  text: { flex: 1, color: palette.textSecondary, fontSize: 13 },
  action: { color: palette.amber, fontSize: 13, fontWeight: '700' },
});

export default ApprovalsBanner;
```

- [ ] **Step 4: Implement StatsRow**

Create `src/screens/Dashboard/OfficeWorker/components/StatsRow.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, PLACEHOLDER_DASH } from '../../shared/palette';

export interface StatItem {
  label: string;
  value: number | null;
}

interface Props {
  stats: StatItem[];
}

const StatsRow: React.FC<Props> = ({ stats }) => (
  <View style={styles.row}>
    {stats.map((s, idx) => (
      <View key={s.label} style={[styles.cell, idx > 0 && styles.cellBorder]}>
        <Text style={styles.label}>{s.label}</Text>
        <Text style={styles.value}>{s.value == null ? PLACEHOLDER_DASH : String(s.value)}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: palette.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  cell: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  cellBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.divider },
  label: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 4,
  },
  value: { color: palette.textPrimary, fontSize: 22, fontWeight: '700' },
});

export default StatsRow;
```

- [ ] **Step 5: Run — verify they pass**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/components/__tests__/ApprovalsBanner.test.tsx src/screens/Dashboard/OfficeWorker/components/__tests__/StatsRow.test.tsx
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Dashboard/OfficeWorker/components/ApprovalsBanner.tsx src/screens/Dashboard/OfficeWorker/components/StatsRow.tsx src/screens/Dashboard/OfficeWorker/components/__tests__/
git commit -m "feat(dashboard): add ApprovalsBanner and StatsRow"
```

---

## Task 12: WhereTab content component

**Files:**
- Create: `src/screens/Dashboard/OfficeWorker/tabs/WhereTab.tsx`
- Test: `src/screens/Dashboard/OfficeWorker/tabs/__tests__/WhereTab.test.tsx`

Composes the Where-tab body: filter chips + LOCATIONS heading + 2-col grid of `LocationCard`.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/OfficeWorker/tabs/__tests__/WhereTab.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import WhereTab from '../WhereTab';
import type { LocationItem } from '../../types';

const sampleLocations: LocationItem[] = [
  { id: 1, kind: 'site',     name: 'Chelsea Wharf',  code: 'CHW-04', toolCount: 8, workerInitials: ['MJ'] },
  { id: 2, kind: 'vehicle',  name: 'Transit Van 02', code: 'VAN-02', toolCount: 4, workerInitials: ['DT'] },
  { id: 3, kind: 'toolbox',  name: 'Toolbox A (HQ)', code: 'TB-A',   toolCount: 6, workerInitials: [] },
];

describe('WhereTab', () => {
  it('shows all locations when filter is "all"', () => {
    render(<WhereTab locations={sampleLocations} totalToolsPlaced={18} pendingApprovals={null} returnsDue={null} onLocationPress={() => {}} onReview={() => {}} />);
    expect(screen.getByText('Chelsea Wharf')).toBeTruthy();
    expect(screen.getByText('Transit Van 02')).toBeTruthy();
    expect(screen.getByText('Toolbox A (HQ)')).toBeTruthy();
  });

  it('filters to vehicles when Vehicles chip pressed', () => {
    render(<WhereTab locations={sampleLocations} totalToolsPlaced={18} pendingApprovals={null} returnsDue={null} onLocationPress={() => {}} onReview={() => {}} />);
    fireEvent.press(screen.getByLabelText('Vehicles filter'));
    expect(screen.getByText('Transit Van 02')).toBeTruthy();
    expect(screen.queryByText('Chelsea Wharf')).toBeNull();
    expect(screen.queryByText('Toolbox A (HQ)')).toBeNull();
  });

  it('renders empty copy when no locations match', () => {
    render(<WhereTab locations={[]} totalToolsPlaced={0} pendingApprovals={null} returnsDue={null} onLocationPress={() => {}} onReview={() => {}} />);
    expect(screen.getByText('No locations yet')).toBeTruthy();
  });

  it('passes location id through to onLocationPress', () => {
    const onLocationPress = jest.fn();
    render(<WhereTab locations={sampleLocations} totalToolsPlaced={18} pendingApprovals={null} returnsDue={null} onLocationPress={onLocationPress} onReview={() => {}} />);
    fireEvent.press(screen.getByLabelText('Chelsea Wharf, 8 tools'));
    expect(onLocationPress).toHaveBeenCalledWith(sampleLocations[0]);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/tabs/__tests__/WhereTab.test.tsx
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/OfficeWorker/tabs/WhereTab.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FilterChips, { FilterChipItem } from '../components/FilterChips';
import ApprovalsBanner from '../components/ApprovalsBanner';
import LocationCard from '../../shared/components/LocationCard';
import { palette } from '../../shared/palette';
import type { LocationItem } from '../types';

type WhereFilter = 'all' | 'sites' | 'vehicles' | 'toolboxes';

const FILTERS: FilterChipItem<WhereFilter>[] = [
  { key: 'all', label: 'All' },
  { key: 'sites', label: 'Sites' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'toolboxes', label: 'Toolboxes' },
];

interface Props {
  locations: LocationItem[];
  totalToolsPlaced: number;
  pendingApprovals: number | null;
  returnsDue: number | null;
  onLocationPress: (location: LocationItem) => void;
  onReview: () => void;
}

const KIND_FOR_FILTER: Record<WhereFilter, LocationItem['kind'] | null> = {
  all: null,
  sites: 'site',
  vehicles: 'vehicle',
  toolboxes: 'toolbox',
};

const WhereTab: React.FC<Props> = ({
  locations,
  totalToolsPlaced,
  pendingApprovals,
  returnsDue,
  onLocationPress,
  onReview,
}) => {
  const [filter, setFilter] = useState<WhereFilter>('all');

  const visible = useMemo(() => {
    const kind = KIND_FOR_FILTER[filter];
    if (kind === null) return locations;
    return locations.filter((l) => l.kind === kind);
  }, [filter, locations]);

  const rows = useMemo(() => {
    const out: LocationItem[][] = [];
    for (let i = 0; i < visible.length; i += 2) out.push(visible.slice(i, i + 2));
    return out;
  }, [visible]);

  return (
    <View>
      <ApprovalsBanner
        pendingApprovals={pendingApprovals}
        returnsDue={returnsDue}
        onReview={onReview}
      />
      <FilterChips items={FILTERS} value={filter} onChange={setFilter} />
      <View style={styles.headingRow}>
        <Text style={styles.heading}>LOCATIONS</Text>
        <Text style={styles.headingRight}>{totalToolsPlaced} devices placed</Text>
      </View>
      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No locations yet</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {row.map((item) => (
                <LocationCard
                  key={item.id}
                  kind={item.kind}
                  name={item.name}
                  code={item.code}
                  toolCount={item.toolCount}
                  workerInitials={item.workerInitials}
                  onPress={() => onLocationPress(item)}
                />
              ))}
              {row.length === 1 ? <View style={styles.spacer} /> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  heading: { color: palette.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  headingRight: { color: palette.textMuted, fontSize: 12 },
  grid: { paddingHorizontal: 18 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  spacer: { flex: 1 },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default WhereTab;
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/tabs/__tests__/WhereTab.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/OfficeWorker/tabs/WhereTab.tsx src/screens/Dashboard/OfficeWorker/tabs/__tests__/WhereTab.test.tsx
git commit -m "feat(dashboard): add WhereTab content"
```

---

## Task 13: TeamRosterTab content component

**Files:**
- Create: `src/screens/Dashboard/OfficeWorker/tabs/TeamRosterTab.tsx`
- Test: `src/screens/Dashboard/OfficeWorker/tabs/__tests__/TeamRosterTab.test.tsx`

Composes the Team-tab body: stats row + WHO HAS WHAT heading + member card list.

- [ ] **Step 1: Write failing test**

Create `src/screens/Dashboard/OfficeWorker/tabs/__tests__/TeamRosterTab.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TeamRosterTab from '../TeamRosterTab';
import type { MemberRow } from '../../types';

const members: MemberRow[] = [
  { memberId: 200, initials: 'WJ', name: 'Wendy Jones',     metaPrimary: 'CHW-04 · Site lead', toolCount: 3 },
  { memberId: 201, initials: 'SW', name: 'Sylvia Williams', metaPrimary: 'CHW-04 · Foreman',   toolCount: 2 },
];

describe('TeamRosterTab', () => {
  it('renders WHO HAS WHAT and member rows', () => {
    render(<TeamRosterTab members={members} totalMembers={2} totalToolsOut={5} onSite={1} hq={1} onMemberPress={() => {}} />);
    expect(screen.getByText('WHO HAS WHAT')).toBeTruthy();
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
    expect(screen.getByText('Sylvia Williams')).toBeTruthy();
  });

  it('renders empty copy when no members', () => {
    render(<TeamRosterTab members={[]} totalMembers={0} totalToolsOut={0} onSite={null} hq={null} onMemberPress={() => {}} />);
    expect(screen.getByText('No teammates yet')).toBeTruthy();
  });

  it('passes memberId through to onMemberPress', () => {
    const onMemberPress = jest.fn();
    render(<TeamRosterTab members={members} totalMembers={2} totalToolsOut={5} onSite={1} hq={1} onMemberPress={onMemberPress} />);
    fireEvent.press(screen.getByLabelText('View Wendy Jones'));
    expect(onMemberPress).toHaveBeenCalledWith(200);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/tabs/__tests__/TeamRosterTab.test.tsx
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/Dashboard/OfficeWorker/tabs/TeamRosterTab.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import StatsRow from '../components/StatsRow';
import MemberCard from '../../shared/components/MemberCard';
import { palette } from '../../shared/palette';
import type { MemberRow } from '../types';

interface Props {
  members: MemberRow[];
  totalMembers: number;
  totalToolsOut: number;
  onSite: number | null;
  hq: number | null;
  onMemberPress: (memberId: number) => void;
}

const TeamRosterTab: React.FC<Props> = ({
  members,
  totalMembers,
  totalToolsOut,
  onSite,
  hq,
  onMemberPress,
}) => (
  <View>
    <StatsRow stats={[
      { label: 'ON SITE',   value: onSite },
      { label: 'HQ',        value: hq },
      { label: 'TOOLS OUT', value: totalToolsOut },
    ]} />
    <View style={styles.headingRow}>
      <Text style={styles.heading}>WHO HAS WHAT</Text>
      <Text style={styles.headingRight}>{totalMembers} {totalMembers === 1 ? 'member' : 'members'}</Text>
    </View>
    {members.length === 0 ? (
      <View style={styles.empty}><Text style={styles.emptyText}>No teammates yet</Text></View>
    ) : (
      members.map((m) => (
        <MemberCard
          key={m.memberId}
          initials={m.initials}
          name={m.name}
          metaPrimary={m.metaPrimary}
          metaSecondary={m.metaSecondary}
          toolCount={m.toolCount}
          onViewPress={() => onMemberPress(m.memberId)}
        />
      ))
    )}
  </View>
);

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  heading: { color: palette.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  headingRight: { color: palette.textMuted, fontSize: 12 },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default TeamRosterTab;
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/Dashboard/OfficeWorker/tabs/__tests__/TeamRosterTab.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard/OfficeWorker/tabs/TeamRosterTab.tsx src/screens/Dashboard/OfficeWorker/tabs/__tests__/TeamRosterTab.test.tsx
git commit -m "feat(dashboard): add TeamRosterTab content"
```

---

## Task 14: OfficeWorkerDashboardScreen + role-router wiring

**Files:**
- Create: `src/screens/Dashboard/OfficeWorker/OfficeWorkerDashboardScreen.tsx`
- Modify: `src/screens/Dashboard/DashboardScreen.tsx` (add `office_worker` branch)
- Update: `src/screens/Dashboard/__tests__/DashboardScreen.test.tsx` (add `office_worker` case)

The parent screen: header + segmented control + active tab content + quick actions for the active tab. Wires data hooks, navigation, and refresh.

- [ ] **Step 1: Update DashboardScreen test to expect new screen for office_worker**

Open `src/screens/Dashboard/__tests__/DashboardScreen.test.tsx` and add a new test case AFTER the existing `it('renders Control room quick actions for owner role', ...)` block (and BEFORE the closing `})` of the `describe`):

```tsx
  it('renders office-worker dashboard for office_worker role', () => {
    currentRole = 'office_worker';
    render(<DashboardScreen />);
    expect(screen.getByLabelText('Where tab')).toBeTruthy();
    expect(screen.getByLabelText('Team tab')).toBeTruthy();
  });
```

Also add this mock block at the top of the file BEFORE the `describe` block (alongside the existing `jest.mock` calls), so the new screen's hooks don't trip up the existing role tests:

```tsx
jest.mock('../OfficeWorker/hooks/useOfficeWorkerWhereData', () => ({
  useOfficeWorkerWhereData: () => ({
    isLoading: false,
    refresh: jest.fn(),
    organizationName: 'TESTORG',
    userInitials: 'XY',
    hasUnreadAlerts: null,
    counts: { sites: 0, vehicles: 0, toolboxes: 0, total: 0 },
    totalToolsPlaced: 0,
    locations: [],
    pendingApprovals: null,
    returnsDue: null,
  }),
}));
jest.mock('../OfficeWorker/hooks/useOfficeWorkerTeamData', () => ({
  useOfficeWorkerTeamData: () => ({
    isLoading: false,
    refresh: jest.fn(),
    organizationName: 'TESTORG',
    userInitials: 'XY',
    hasUnreadAlerts: null,
    totalMembers: 0,
    totalToolsOut: 0,
    onSite: null,
    hq: null,
    members: [],
  }),
}));
```

- [ ] **Step 2: Run — verify the new test fails (others pass)**

```bash
npm test -- src/screens/Dashboard/__tests__/DashboardScreen.test.tsx
```

Expected: 3 PASS, 1 FAIL ("Where tab" not found — `OfficeWorkerDashboardScreen` doesn't exist yet).

- [ ] **Step 3: Implement OfficeWorkerDashboardScreen**

Create `src/screens/Dashboard/OfficeWorker/OfficeWorkerDashboardScreen.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
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
import SegmentedTabs, { SegmentedValue } from './components/SegmentedTabs';
import WhereTab from './tabs/WhereTab';
import TeamRosterTab from './tabs/TeamRosterTab';
import { palette } from '../shared/palette';
import { useOfficeWorkerWhereData } from './hooks/useOfficeWorkerWhereData';
import { useOfficeWorkerTeamData } from './hooks/useOfficeWorkerTeamData';
import { useScanTag } from '../../../hooks/useScanTag';

const OfficeWorkerDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const where = useOfficeWorkerWhereData();
  const team = useOfficeWorkerTeamData();
  const [tab, setTab] = useState<SegmentedValue>('left');
  const { scan } = useScanTag();

  const isLeft = tab === 'left';

  const tagline = isLeft
    ? `${where.organizationName || 'YOUR ORGANIZATION'} / OFFICE`
    : `${team.organizationName || 'YOUR ORGANIZATION'} / OFFICE`;
  const title = isLeft ? "Where's everything?" : 'Team roster';
  const subtitle = isLeft
    ? buildWhereSubtitle(where.counts)
    : `${team.totalMembers} ${team.totalMembers === 1 ? 'member' : 'members'} · ${team.totalToolsOut} tools out`;

  const quickActions: QuickActionItem[] = useMemo(
    () => isLeft
      ? [
          { key: 'place', label: 'Place tool', icon: 'add', primary: true, onPress: () => scan() },
          { key: 'move',  label: 'Move',       icon: 'swap-horizontal-outline', onPress: () => scan() },
          { key: 'assign',label: 'Assign',     icon: 'person-outline',          onPress: () => navigation.navigate('AllDevices') },
          // BACKEND_GAP: no export endpoint — routes to AllReports for now.
          { key: 'export',label: 'Export',     icon: 'download-outline',        onPress: () => navigation.navigate('AllReports') },
        ]
      : [
          { key: 'assign',label: 'Assign',     icon: 'person-outline', primary: true, onPress: () => navigation.navigate('AllDevices') },
          // BACKEND_GAP: no export endpoint — routes to AllReports for now.
          { key: 'export',label: 'Export',     icon: 'download-outline',                onPress: () => navigation.navigate('AllReports') },
        ],
    [isLeft, navigation, scan],
  );

  const isFirstLoad = isLeft
    ? where.isLoading && where.locations.length === 0
    : team.isLoading && team.members.length === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLeft ? where.isLoading : team.isLoading}
            onRefresh={isLeft ? where.refresh : team.refresh}
            tintColor={palette.amber}
          />
        }
      >
        <DashboardHeader
          tagline={tagline}
          title={title}
          subtitle={subtitle}
          initials={isLeft ? where.userInitials : team.userInitials}
          hasUnreadAlerts={isLeft ? where.hasUnreadAlerts : team.hasUnreadAlerts}
          onAlertsPress={() => navigation.navigate('NotificationPreferences')}
          onAvatarPress={() => navigation.navigate('settings')}
        />
        <QuickActions items={quickActions} />
        <SegmentedTabs left="Where" right="Team" value={tab} onChange={setTab} />

        {isFirstLoad ? (
          <View style={styles.loader}><ActivityIndicator color={palette.amber} /></View>
        ) : null}
        {(isLeft ? where.error : team.error) ? (
          <Text style={styles.errorText}>{isLeft ? where.error : team.error}</Text>
        ) : null}

        {isLeft ? (
          <WhereTab
            locations={where.locations}
            totalToolsPlaced={where.totalToolsPlaced}
            pendingApprovals={where.pendingApprovals}
            returnsDue={where.returnsDue}
            onLocationPress={(loc) => navigation.navigate('LocationDetail', { id: loc.id, kind: loc.kind })}
            onReview={() => navigation.navigate('NotificationPreferences')}
          />
        ) : (
          <TeamRosterTab
            members={team.members}
            totalMembers={team.totalMembers}
            totalToolsOut={team.totalToolsOut}
            onSite={team.onSite}
            hq={team.hq}
            onMemberPress={(memberId) => navigation.navigate('TeamMemberDetail', { memberId })}
          />
        )}
      </ScrollView>
    </View>
  );
};

function buildWhereSubtitle(counts: { sites: number; vehicles: number; toolboxes: number }): string {
  const parts: string[] = [];
  if (counts.sites > 0) parts.push(`${counts.sites} site${counts.sites === 1 ? '' : 's'}`);
  if (counts.vehicles > 0) parts.push(`${counts.vehicles} vehicle${counts.vehicles === 1 ? '' : 's'}`);
  if (counts.toolboxes > 0) parts.push(`${counts.toolboxes} toolbox${counts.toolboxes === 1 ? '' : 'es'}`);
  return parts.length === 0 ? 'No locations yet' : parts.join(' · ');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 28, paddingTop: 6 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: {
    color: palette.red,
    fontSize: 12,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
});

export default OfficeWorkerDashboardScreen;
```

- [ ] **Step 4: Wire role-router**

Edit `src/screens/Dashboard/DashboardScreen.tsx`. Add this import at the top of the existing import block:

```tsx
import OfficeWorkerDashboardScreen from './OfficeWorker/OfficeWorkerDashboardScreen';
```

Then change the role-routing block. Replace:

```tsx
  if (role === 'owner') {
    return <ControlRoomScreen />;
  }
  if (role === 'admin') {
    return <FleetStatusScreen />;
  }
  return <StandardDashboard role={role} />;
```

With:

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
  return <StandardDashboard role={role} />;
```

- [ ] **Step 5: Run — verify all four tests pass**

```bash
npm test -- src/screens/Dashboard/__tests__/DashboardScreen.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Dashboard/OfficeWorker/OfficeWorkerDashboardScreen.tsx src/screens/Dashboard/DashboardScreen.tsx src/screens/Dashboard/__tests__/DashboardScreen.test.tsx
git commit -m "feat(dashboard): wire OfficeWorkerDashboardScreen for office_worker role"
```

---

## Task 15: useLocationDetail hook

**Files:**
- Create: `src/screens/LocationDetail/hooks/useLocationDetail.ts`
- Test: `src/screens/LocationDetail/hooks/__tests__/useLocationDetail.test.ts`

Loads the site/van plus its assignments + site assignments, derives the Users and Tools lists.

- [ ] **Step 1: Write failing test**

Create `src/screens/LocationDetail/hooks/__tests__/useLocationDetail.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useLocationDetail } from '../useLocationDetail';

const mockGetSite = jest.fn();
const mockGetVan = jest.fn();
const mockListAssignmentsBySite = jest.fn();
const mockListSiteAssignments = jest.fn();
const mockListMembers = jest.fn();

jest.mock('../../../../api/endpoints', () => ({
  sites: { getSite: (...args: any[]) => mockGetSite(...args) },
  vans: { getVan: (...args: any[]) => mockGetVan(...args) },
  assignments: { listAssignmentsBySite: (...args: any[]) => mockListAssignmentsBySite(...args) },
  siteAssignments: { listSiteAssignments: (...args: any[]) => mockListSiteAssignments(...args) },
  members: { listMembers: (...args: any[]) => mockListMembers(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSite.mockResolvedValue({ id: 1, name: 'Chelsea Wharf', site_type: 'site', prefix_code: 'CHW-04', status: 'active' });
  mockListAssignmentsBySite.mockResolvedValue({
    items: [
      { id: 1, tool_id: 11, tool_name: 'Drill',  status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1 },
      { id: 2, tool_id: 12, tool_name: 'Saw',    status: 'active', assignee_user_id: 201, assignee_user_email: 'sw@x.com', assignee_site_id: 1 },
      { id: 3, tool_id: 13, tool_name: 'Hammer', status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1 },
    ],
    total: 3, page: 1, page_size: 50, total_pages: 1,
  });
  mockListSiteAssignments.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
  mockListMembers.mockResolvedValue({
    items: [
      { id: 1, user_id: 200, first_name: 'Wendy',  last_name: 'Jones',    email: 'wj@x.com', role: 'site_worker', is_active: true, is_primary: false, joined_at: '' },
      { id: 2, user_id: 201, first_name: 'Sylvia', last_name: 'Williams', email: 'sw@x.com', role: 'site_worker', is_active: true, is_primary: false, joined_at: '' },
    ],
    total: 2, page: 1, page_size: 50, total_pages: 1,
  });
});

describe('useLocationDetail (site)', () => {
  it('loads the site and renders its name + code', async () => {
    const { result } = renderHook(() => useLocationDetail(1, 'site'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.name).toBe('Chelsea Wharf');
    expect(result.current.code).toBe('CHW-04');
  });

  it('deduplicates users into the Users tab and counts tools per user', async () => {
    const { result } = renderHook(() => useLocationDetail(1, 'site'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.users).toHaveLength(2);
    const wendy = result.current.users.find(u => u.name === 'Wendy Jones');
    expect(wendy?.toolCount).toBe(2);
  });

  it('builds tools list with assignee names', async () => {
    const { result } = renderHook(() => useLocationDetail(1, 'site'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tools).toHaveLength(3);
    expect(result.current.tools[0].assigneeName).toBeDefined();
  });
});

describe('useLocationDetail (vehicle)', () => {
  beforeEach(() => {
    mockGetVan.mockResolvedValue({ id: 10, name: 'Transit Van 02', prefix_code: 'VAN-02', status: 'active' });
    mockListAssignmentsBySite.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
  });
  it('loads van metadata when kind is vehicle', async () => {
    const { result } = renderHook(() => useLocationDetail(10, 'vehicle'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.name).toBe('Transit Van 02');
    expect(mockGetVan).toHaveBeenCalledWith(10);
    expect(mockGetSite).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/LocationDetail/hooks/__tests__/useLocationDetail.test.ts
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/LocationDetail/hooks/useLocationDetail.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  sites as sitesApi,
  vans as vansApi,
  assignments as assignmentsApi,
  siteAssignments as siteAssignmentsApi,
  members as membersApi,
} from '../../../api/endpoints';
import type { AssignmentRead, MemberRead, SiteAssignmentRead } from '../../../api/types';
import { computeInitials } from '../../Dashboard/shared/identity';
import type { LocationKind } from '../../Dashboard/shared/components/KindBadge';

export interface UserRow {
  memberId: number;
  initials: string;
  name: string;
  metaPrimary: string;
  toolCount: number;
}

export interface ToolRow {
  toolId: number;
  name: string;
  identifier: string;
  status?: string;
  assigneeName?: string;
}

export interface LocationDetailData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;
  kind: LocationKind;
  name: string;
  code: string;
  users: UserRow[];
  tools: ToolRow[];
}

export function useLocationDetail(id: number, kind: LocationKind): LocationDetailData {
  const [meta, setMeta] = useState<{ name: string; code: string }>({ name: '', code: '' });
  const [assignments, setAssignments] = useState<AssignmentRead[]>([]);
  const [siteAssignments, setSiteAssignments] = useState<SiteAssignmentRead[]>([]);
  const [members, setMembers] = useState<MemberRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const metaPromise = kind === 'vehicle'
        ? vansApi.getVan(id).then((v) => ({ name: v.name, code: v.prefix_code || v.nickname || '' }))
        : sitesApi.getSite(id).then((s) => ({ name: s.name, code: s.prefix_code || s.nickname || '' }));

      const [m, a, sa, mp] = await Promise.all([
        metaPromise,
        // BACKEND_GAP: vans don't have a dedicated list-assignments endpoint;
        // listAssignmentsBySite for kind=vehicle may return empty until backend ships it.
        assignmentsApi.listAssignmentsBySite(id).catch(() => ({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 })),
        kind === 'vehicle'
          ? Promise.resolve({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 })
          : siteAssignmentsApi.listSiteAssignments({ site: id }).catch(() => ({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 })),
        membersApi.listMembers(),
      ]);

      setMeta(m);
      setAssignments(a.items);
      setSiteAssignments(sa.items);
      setMembers(mp.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load location');
    } finally {
      setIsLoading(false);
    }
  }, [id, kind]);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<LocationDetailData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const memberByUserId = new Map<number, MemberRead>();
    for (const m of members) memberByUserId.set(m.user_id, m);

    const toolCountByUser = new Map<number, number>();
    for (const a of assignments) {
      if (a.assignee_user_id == null) continue;
      toolCountByUser.set(a.assignee_user_id, (toolCountByUser.get(a.assignee_user_id) ?? 0) + 1);
    }

    const userIds = new Set<number>();
    for (const a of assignments) {
      if (a.assignee_user_id != null) userIds.add(a.assignee_user_id);
    }
    for (const sa of siteAssignments) {
      if (sa.is_active) userIds.add(sa.user_id);
    }

    const users: UserRow[] = Array.from(userIds).map((uid) => {
      const m = memberByUserId.get(uid);
      const name = m ? `${m.first_name} ${m.last_name}`.trim() || m.email : `User #${uid}`;
      const sa = siteAssignments.find((s) => s.user_id === uid && s.is_active);
      return {
        memberId: uid,
        initials: m ? computeInitials(m.first_name, m.last_name, m.email) : '?',
        name,
        metaPrimary: sa?.role || (m ? roleLabel(m.role) : ''),
        toolCount: toolCountByUser.get(uid) ?? 0,
      };
    });

    const tools: ToolRow[] = assignments.map((a) => {
      const m = a.assignee_user_id != null ? memberByUserId.get(a.assignee_user_id) : undefined;
      const assigneeName = m ? `${m.first_name} ${m.last_name}`.trim() || m.email : a.assignee_user_email || undefined;
      return {
        toolId: a.tool_id,
        name: a.tool_name || `Tool #${a.tool_id}`,
        identifier: `#${a.tool_id}`,
        status: a.status,
        assigneeName,
      };
    });

    return { kind, name: meta.name, code: meta.code, users, tools };
  }, [assignments, siteAssignments, members, meta, kind]);

  return { ...data, isLoading, error, refresh: load };
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    office_worker: 'Office worker',
    site_worker: 'Site worker',
    admin: 'Admin',
    owner: 'Owner',
  };
  return map[role] ?? role.replace(/_/g, ' ');
}
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/LocationDetail/hooks/__tests__/useLocationDetail.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/LocationDetail/hooks/useLocationDetail.ts src/screens/LocationDetail/hooks/__tests__/useLocationDetail.test.ts
git commit -m "feat(location-detail): add useLocationDetail hook"
```

---

## Task 16: LocationDetailScreen

**Files:**
- Create: `src/screens/LocationDetail/LocationDetailScreen.tsx`
- Test: `src/screens/LocationDetail/__tests__/LocationDetailScreen.test.tsx`

Drill-down screen with Users|Tools segmented tabs.

- [ ] **Step 1: Write failing test**

Create `src/screens/LocationDetail/__tests__/LocationDetailScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LocationDetailScreen from '../LocationDetailScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
  useRoute: () => ({ params: { id: 1, kind: 'site' } }),
}));

const baseHook = {
  isLoading: false,
  refresh: jest.fn(),
  kind: 'site' as const,
  name: 'Chelsea Wharf',
  code: 'CHW-04',
  users: [
    { memberId: 200, initials: 'WJ', name: 'Wendy Jones',     metaPrimary: 'Site lead', toolCount: 2 },
    { memberId: 201, initials: 'SW', name: 'Sylvia Williams', metaPrimary: 'Foreman',   toolCount: 1 },
  ],
  tools: [
    { toolId: 11, name: 'Drill', identifier: '#11', status: 'active' as const, assigneeName: 'Wendy Jones' },
  ],
};
const useLocationDetailMock = jest.fn(() => baseHook);

jest.mock('../hooks/useLocationDetail', () => ({
  useLocationDetail: (...args: any[]) => useLocationDetailMock(...args),
}));

beforeEach(() => {
  mockNavigate.mockClear();
  useLocationDetailMock.mockReturnValue(baseHook);
});

describe('LocationDetailScreen', () => {
  it('renders Users tab by default with member rows', () => {
    render(<LocationDetailScreen />);
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
    expect(screen.getByText('Sylvia Williams')).toBeTruthy();
  });

  it('switches to Tools tab on press', () => {
    render(<LocationDetailScreen />);
    fireEvent.press(screen.getByLabelText('Tools tab'));
    expect(screen.getByText('Drill')).toBeTruthy();
  });

  it('navigates to TeamMemberDetail on user press', () => {
    render(<LocationDetailScreen />);
    fireEvent.press(screen.getByLabelText('View Wendy Jones'));
    expect(mockNavigate).toHaveBeenCalledWith('TeamMemberDetail', { memberId: 200 });
  });

  it('navigates to DeviceDetails on tool press', () => {
    render(<LocationDetailScreen />);
    fireEvent.press(screen.getByLabelText('Tools tab'));
    fireEvent.press(screen.getByLabelText('Drill'));
    expect(mockNavigate).toHaveBeenCalledWith('DeviceDetails', { id: 11 });
  });

  it('renders empty copy on Users tab when no users', () => {
    useLocationDetailMock.mockReturnValueOnce({ ...baseHook, users: [] });
    render(<LocationDetailScreen />);
    expect(screen.getByText('No one assigned tools here')).toBeTruthy();
  });

  it('renders empty copy on Tools tab when no tools', () => {
    useLocationDetailMock.mockReturnValueOnce({ ...baseHook, tools: [] });
    render(<LocationDetailScreen />);
    fireEvent.press(screen.getByLabelText('Tools tab'));
    expect(screen.getByText('No tools here yet')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/LocationDetail/__tests__/LocationDetailScreen.test.tsx
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/LocationDetail/LocationDetailScreen.tsx`:

```tsx
import React, { useLayoutEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import SegmentedTabs, { SegmentedValue } from '../Dashboard/OfficeWorker/components/SegmentedTabs';
import MemberCard from '../Dashboard/shared/components/MemberCard';
import ToolCard from '../Dashboard/shared/components/ToolCard';
import KindBadge from '../Dashboard/shared/components/KindBadge';
import { palette } from '../Dashboard/shared/palette';
import { useLocationDetail } from './hooks/useLocationDetail';
import type { LocationKind } from '../Dashboard/shared/components/KindBadge';

type Params = { id: number; kind: LocationKind };

const LocationDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: Params }, 'params'>>();
  const { id, kind } = route.params;
  const data = useLocationDetail(id, kind);
  const [tab, setTab] = useState<SegmentedValue>('left');

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: data.name || 'Location' });
  }, [navigation, data.name]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={data.isLoading} onRefresh={data.refresh} tintColor={palette.amber} />
        }
      >
        <View style={styles.header}>
          <KindBadge kind={data.kind} />
          <Text style={styles.title} numberOfLines={1}>{data.name}</Text>
          <Text style={styles.code} numberOfLines={1}>{data.code}</Text>
        </View>

        <SegmentedTabs left="Users" right="Tools" value={tab} onChange={setTab} />

        {data.isLoading && data.users.length === 0 && data.tools.length === 0 ? (
          <View style={styles.loader}><ActivityIndicator color={palette.amber} /></View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        {tab === 'left' ? (
          data.users.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No one assigned tools here</Text></View>
          ) : (
            data.users.map((u) => (
              <MemberCard
                key={u.memberId}
                initials={u.initials}
                name={u.name}
                metaPrimary={u.metaPrimary}
                toolCount={u.toolCount}
                onViewPress={() => navigation.navigate('TeamMemberDetail', { memberId: u.memberId })}
              />
            ))
          )
        ) : (
          data.tools.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No tools here yet</Text></View>
          ) : (
            data.tools.map((t) => (
              <ToolCard
                key={t.toolId}
                name={t.name}
                identifier={t.identifier}
                status={t.status}
                assigneeName={t.assigneeName}
                onPress={() => navigation.navigate('DeviceDetails', { id: t.toolId })}
              />
            ))
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 28, paddingTop: 6 },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  title: { color: palette.textPrimary, fontSize: 26, fontWeight: '700', marginTop: 6 },
  code: { color: palette.textMuted, fontSize: 13, marginTop: 2, marginBottom: 12 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: { color: palette.red, fontSize: 12, paddingHorizontal: 18, paddingVertical: 6 },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default LocationDetailScreen;
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/LocationDetail/__tests__/LocationDetailScreen.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/LocationDetail/LocationDetailScreen.tsx src/screens/LocationDetail/__tests__/LocationDetailScreen.test.tsx
git commit -m "feat(location-detail): add LocationDetailScreen with Users|Tools tabs"
```

---

## Task 17: useTeamMemberDetail hook + TeamMemberDetailScreen

**Files:**
- Create: `src/screens/TeamMemberDetail/hooks/useTeamMemberDetail.ts`
- Create: `src/screens/TeamMemberDetail/TeamMemberDetailScreen.tsx`
- Test: `src/screens/TeamMemberDetail/hooks/__tests__/useTeamMemberDetail.test.ts`
- Test: `src/screens/TeamMemberDetail/__tests__/TeamMemberDetailScreen.test.tsx`

Profile header + assigned tools list.

- [ ] **Step 1: Write failing hook test**

Create `src/screens/TeamMemberDetail/hooks/__tests__/useTeamMemberDetail.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useTeamMemberDetail } from '../useTeamMemberDetail';

const mockGetMember = jest.fn();
const mockListAssignments = jest.fn();

jest.mock('../../../../api/endpoints', () => ({
  members: { getMember: (...args: any[]) => mockGetMember(...args) },
  assignments: { listAssignments: (...args: any[]) => mockListAssignments(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMember.mockResolvedValue({
    id: 1, user_id: 200, first_name: 'Wendy', last_name: 'Jones', email: 'wj@x.com', role: 'site_worker', is_active: true, is_primary: false, joined_at: '',
  });
  mockListAssignments.mockResolvedValue({
    items: [
      { id: 1, tool_id: 11, tool_name: 'Drill', status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 2, tool_id: 12, tool_name: 'Saw',   status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
    ],
    total: 2, page: 1, page_size: 50, total_pages: 1,
  });
});

describe('useTeamMemberDetail', () => {
  it('loads member name + role', async () => {
    const { result } = renderHook(() => useTeamMemberDetail(200));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.name).toBe('Wendy Jones');
    expect(result.current.role).toBe('Site worker');
  });

  it('loads assigned tools filtered by user', async () => {
    const { result } = renderHook(() => useTeamMemberDetail(200));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tools).toHaveLength(2);
    expect(mockListAssignments).toHaveBeenCalledWith({ status: 'active', user: 200 });
  });
});
```

- [ ] **Step 2: Write failing screen test**

Create `src/screens/TeamMemberDetail/__tests__/TeamMemberDetailScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TeamMemberDetailScreen from '../TeamMemberDetailScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
  useRoute: () => ({ params: { memberId: 200 } }),
}));

const hookResult = {
  isLoading: false,
  refresh: jest.fn(),
  initials: 'WJ',
  name: 'Wendy Jones',
  email: 'wj@x.com',
  role: 'Site worker',
  tools: [
    { toolId: 11, name: 'Drill', identifier: '#11', status: 'active' as const },
    { toolId: 12, name: 'Saw',   identifier: '#12', status: 'active' as const },
  ],
};

jest.mock('../hooks/useTeamMemberDetail', () => ({
  useTeamMemberDetail: () => hookResult,
}));

beforeEach(() => mockNavigate.mockClear());

describe('TeamMemberDetailScreen', () => {
  it('renders profile header and tools list', () => {
    render(<TeamMemberDetailScreen />);
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
    expect(screen.getByText('Site worker')).toBeTruthy();
    expect(screen.getByText('Drill')).toBeTruthy();
    expect(screen.getByText('Saw')).toBeTruthy();
  });

  it('navigates to DeviceDetails on tool press', () => {
    render(<TeamMemberDetailScreen />);
    fireEvent.press(screen.getByLabelText('Drill'));
    expect(mockNavigate).toHaveBeenCalledWith('DeviceDetails', { id: 11 });
  });
});
```

- [ ] **Step 3: Run both — verify they fail**

```bash
npm test -- src/screens/TeamMemberDetail/
```

Expected: 2 FAIL "Cannot find module".

- [ ] **Step 4: Implement hook**

Create `src/screens/TeamMemberDetail/hooks/useTeamMemberDetail.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  members as membersApi,
  assignments as assignmentsApi,
} from '../../../api/endpoints';
import type { AssignmentRead, MemberRead } from '../../../api/types';
import { computeInitials } from '../../Dashboard/shared/identity';

export interface MemberToolRow {
  toolId: number;
  name: string;
  identifier: string;
  status?: string;
}

export interface TeamMemberDetailData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;
  initials: string;
  name: string;
  email: string;
  role: string;
  tools: MemberToolRow[];
}

const ROLE_LABEL: Record<string, string> = {
  office_worker: 'Office worker',
  site_worker: 'Site worker',
  admin: 'Admin',
  owner: 'Owner',
};

export function useTeamMemberDetail(memberId: number): TeamMemberDetailData {
  const [member, setMember] = useState<MemberRead | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [m, a] = await Promise.all([
        membersApi.getMember(memberId),
        assignmentsApi.listAssignments({ status: 'active', user: memberId }),
      ]);
      setMember(m);
      setAssignments(a.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team member');
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<TeamMemberDetailData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const name = member ? `${member.first_name} ${member.last_name}`.trim() || member.email : '';
    return {
      initials: member ? computeInitials(member.first_name, member.last_name, member.email) : '?',
      name,
      email: member?.email ?? '',
      role: member ? (ROLE_LABEL[member.role] ?? member.role.replace(/_/g, ' ')) : '',
      tools: assignments.map((a) => ({
        toolId: a.tool_id,
        name: a.tool_name || `Tool #${a.tool_id}`,
        identifier: `#${a.tool_id}`,
        status: a.status,
      })),
    };
  }, [member, assignments]);

  return { ...data, isLoading, error, refresh: load };
}
```

- [ ] **Step 5: Implement screen**

Create `src/screens/TeamMemberDetail/TeamMemberDetailScreen.tsx`:

```tsx
import React, { useLayoutEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import ToolCard from '../Dashboard/shared/components/ToolCard';
import { palette } from '../Dashboard/shared/palette';
import { colourFromName } from '../Dashboard/shared/identity';
import { useTeamMemberDetail } from './hooks/useTeamMemberDetail';

type Params = { memberId: number };

const TeamMemberDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: Params }, 'params'>>();
  const { memberId } = route.params;
  const data = useTeamMemberDetail(memberId);

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: data.name || 'Team member' });
  }, [navigation, data.name]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={data.isLoading} onRefresh={data.refresh} tintColor={palette.amber} />
        }
      >
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: data.name ? colourFromName(data.name) : palette.placeholder }]}>
            <Text style={styles.avatarText}>{data.initials}</Text>
          </View>
          <Text style={styles.name}>{data.name}</Text>
          <Text style={styles.role}>{data.role}</Text>
          {data.email ? <Text style={styles.email}>{data.email}</Text> : null}
        </View>

        <View style={styles.headingRow}>
          <Text style={styles.heading}>ASSIGNED TOOLS</Text>
          <Text style={styles.headingRight}>{data.tools.length}</Text>
        </View>

        {data.isLoading && data.tools.length === 0 ? (
          <View style={styles.loader}><ActivityIndicator color={palette.amber} /></View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        {data.tools.length === 0 && !data.isLoading ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No tools currently assigned</Text></View>
        ) : (
          data.tools.map((t) => (
            <ToolCard
              key={t.toolId}
              name={t.name}
              identifier={t.identifier}
              status={t.status}
              onPress={() => navigation.navigate('DeviceDetails', { id: t.toolId })}
            />
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
  profile: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#1B1300', fontSize: 22, fontWeight: '800' },
  name: { color: palette.textPrimary, fontSize: 22, fontWeight: '700' },
  role: { color: palette.textSecondary, fontSize: 13, marginTop: 4 },
  email: { color: palette.textMuted, fontSize: 12, marginTop: 4 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  heading: { color: palette.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  headingRight: { color: palette.textMuted, fontSize: 12 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: { color: palette.red, fontSize: 12, paddingHorizontal: 18, paddingVertical: 6 },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default TeamMemberDetailScreen;
```

- [ ] **Step 6: Run — verify both pass**

```bash
npm test -- src/screens/TeamMemberDetail/
```

Expected: PASS, 4 tests across 2 files.

- [ ] **Step 7: Commit**

```bash
git add src/screens/TeamMemberDetail/
git commit -m "feat(team-member): add TeamMemberDetail hook + screen"
```

---

## Task 18: TeamRosterScreen (standalone for site_workers)

**Files:**
- Create: `src/screens/TeamRoster/TeamRosterScreen.tsx`
- Test: `src/screens/TeamRoster/__tests__/TeamRosterScreen.test.tsx`

Thin wrapper that reuses `TeamRosterTab` content with a `DashboardHeader` above it (no segmented control). Used by site_workers via a profile-menu link.

- [ ] **Step 1: Write failing test**

Create `src/screens/TeamRoster/__tests__/TeamRosterScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TeamRosterScreen from '../TeamRosterScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
}));

jest.mock('../../Dashboard/OfficeWorker/hooks/useOfficeWorkerTeamData', () => ({
  useOfficeWorkerTeamData: () => ({
    isLoading: false,
    refresh: jest.fn(),
    organizationName: 'TESTORG',
    userInitials: 'XY',
    hasUnreadAlerts: null,
    totalMembers: 1,
    totalToolsOut: 3,
    onSite: null,
    hq: null,
    members: [
      { memberId: 200, initials: 'WJ', name: 'Wendy Jones', metaPrimary: 'Site lead', toolCount: 3 },
    ],
  }),
}));

beforeEach(() => mockNavigate.mockClear());

describe('TeamRosterScreen', () => {
  it('renders the roster content', () => {
    render(<TeamRosterScreen />);
    expect(screen.getByText('Team roster')).toBeTruthy();
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
  });

  it('does NOT render the Where/Team segmented control', () => {
    render(<TeamRosterScreen />);
    expect(screen.queryByLabelText('Where tab')).toBeNull();
    expect(screen.queryByLabelText('Team tab')).toBeNull();
  });

  it('navigates to TeamMemberDetail on member press', () => {
    render(<TeamRosterScreen />);
    fireEvent.press(screen.getByLabelText('View Wendy Jones'));
    expect(mockNavigate).toHaveBeenCalledWith('TeamMemberDetail', { memberId: 200 });
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/screens/TeamRoster/__tests__/TeamRosterScreen.test.tsx
```

Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/screens/TeamRoster/TeamRosterScreen.tsx`:

```tsx
import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DashboardHeader from '../Dashboard/shared/components/DashboardHeader';
import TeamRosterTab from '../Dashboard/OfficeWorker/tabs/TeamRosterTab';
import { palette } from '../Dashboard/shared/palette';
import { useOfficeWorkerTeamData } from '../Dashboard/OfficeWorker/hooks/useOfficeWorkerTeamData';

const TeamRosterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const data = useOfficeWorkerTeamData();
  const tagline = `${data.organizationName || 'YOUR ORGANIZATION'} / TEAM`;
  const subtitle = `${data.totalMembers} ${data.totalMembers === 1 ? 'member' : 'members'} · ${data.totalToolsOut} tools out`;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={data.isLoading} onRefresh={data.refresh} tintColor={palette.amber} />
        }
      >
        <DashboardHeader
          tagline={tagline}
          title="Team roster"
          subtitle={subtitle}
          initials={data.userInitials}
          hasUnreadAlerts={data.hasUnreadAlerts}
          onAlertsPress={() => navigation.navigate('NotificationPreferences')}
          onAvatarPress={() => navigation.navigate('settings')}
        />

        {data.isLoading && data.members.length === 0 ? (
          <View style={styles.loader}><ActivityIndicator color={palette.amber} /></View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        <TeamRosterTab
          members={data.members}
          totalMembers={data.totalMembers}
          totalToolsOut={data.totalToolsOut}
          onSite={data.onSite}
          hq={data.hq}
          onMemberPress={(memberId) => navigation.navigate('TeamMemberDetail', { memberId })}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 28, paddingTop: 6 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: { color: palette.red, fontSize: 12, paddingHorizontal: 18, paddingVertical: 6 },
});

export default TeamRosterScreen;
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/screens/TeamRoster/__tests__/TeamRosterScreen.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/screens/TeamRoster/
git commit -m "feat(team-roster): add standalone TeamRosterScreen for site_workers"
```

---

## Task 19: Register new stack screens in navigation

**Files:**
- Modify: `src/navigation/index.tsx`

Add `LocationDetail`, `TeamMemberDetail`, and `TeamRoster` to the main stack.

- [ ] **Step 1: Add imports**

Open `src/navigation/index.tsx`. After the line `import BillingAnalyticsScreen from '../screens/PaymentScreens/BillingAnalyticsScreen';`, add:

```tsx
import LocationDetailScreen from '../screens/LocationDetail/LocationDetailScreen';
import TeamMemberDetailScreen from '../screens/TeamMemberDetail/TeamMemberDetailScreen';
import TeamRosterScreen from '../screens/TeamRoster/TeamRosterScreen';
```

- [ ] **Step 2: Register the three screens**

Inside `MainStack`'s `<Stack.Navigator>`, just before the closing `</Stack.Navigator>` tag (i.e. AFTER the existing `<Stack.Screen name="CreateOrganization" ... />` block), add:

```tsx
    <Stack.Screen
      name="LocationDetail"
      component={LocationDetailScreen}
      options={{
        headerShown: true,
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
    <Stack.Screen
      name="TeamMemberDetail"
      component={TeamMemberDetailScreen}
      options={{
        headerShown: true,
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
    <Stack.Screen
      name="TeamRoster"
      component={TeamRosterScreen}
      options={{
        headerShown: true,
        headerTitle: 'Team',
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
```

- [ ] **Step 3: Manual sanity check — re-run all tests so far**

```bash
npm test -- src/screens/Dashboard src/screens/LocationDetail src/screens/TeamMemberDetail src/screens/TeamRoster
```

Expected: ALL PASS (≈54 tests across these directories).

- [ ] **Step 4: Commit**

```bash
git add src/navigation/index.tsx
git commit -m "feat(navigation): register LocationDetail, TeamMemberDetail, TeamRoster screens"
```

---

## Task 20: Add Team link in site-worker profile menu

**Files:**
- Modify: `src/screens/ProfileScreen.js` (the existing profile screen — add a `navigate('TeamRoster')` row visible to site_workers)

Locate the existing list of menu rows in `ProfileScreen.js`. The exact insert point depends on the file's current structure — find the existing menu section that renders rows like "Edit profile" / "Change password" / "Notifications". Add a new row above the destructive (logout) action, gated on `userData.role === 'site_worker'`.

- [ ] **Step 1: Read the current profile screen layout**

```bash
grep -n -E "TouchableOpacity|menuItem|Edit profile|Change password|navigate\(" src/screens/ProfileScreen.js | head -30
```

This shows the existing menu rows. **Use that output to determine the exact place to insert the new row** (the "Notifications" or "Change password" row is a good neighbor; place the new row immediately AFTER it).

- [ ] **Step 2: Insert the Team menu row**

After the relevant existing row block (e.g. the "Notifications" `<TouchableOpacity>...</TouchableOpacity>` block), insert:

```jsx
{userData?.role === 'site_worker' ? (
  <TouchableOpacity
    style={styles.menuRow}
    onPress={() => navigation.navigate('TeamRoster')}
    accessibilityRole="button"
    accessibilityLabel="Team"
  >
    <Text style={styles.menuText}>Team</Text>
  </TouchableOpacity>
) : null}
```

If the existing rows don't use a `styles.menuRow` / `styles.menuText` pattern, match whatever the surrounding rows use exactly — do not introduce new styles.

- [ ] **Step 3: Manual smoke**

```bash
npm test -- src/screens
```

Expected: tests still pass; `ProfileScreen.js` doesn't have a unit test that needs updating.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ProfileScreen.js
git commit -m "feat(profile): add Team menu row for site_workers (links to TeamRoster)"
```

---

## Task 21: Full test suite + manual verification

**Files:** none.

- [ ] **Step 1: Run the full Jest suite**

```bash
npm test
```

Expected: all suites pass. Note any pre-existing failures unrelated to this branch (e.g. legacy AuthFlow tests called out in the API v1 migration project memory) — record them in the commit message rather than touching unrelated tests.

- [ ] **Step 2: Run TypeScript typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors. If a pre-existing error surfaces from this branch's changes, fix it. Pre-existing errors elsewhere in the codebase that this branch did not introduce can be left alone (note in commit message).

- [ ] **Step 3: Manual verification — Android dev client, office_worker user**

Start the dev server and use the running app. In a real Android dev client (NOT a simulator — NFC requires hardware):

```bash
npm start
```

Walk every flow and confirm:
1. Open the app as an `office_worker`. Bottom tab bar shows the existing 5 tabs with the `Q` Scan FAB centered.
2. Default tab "Dashboard" loads `OfficeWorkerDashboardScreen`. Tagline shows `<ORG> / OFFICE`. Title is "Where's everything?". Subtitle shows site/vehicle/toolbox counts.
3. Quick actions row shows Place tool / Move / Assign / Export.
4. Filter chips: All (active) · Sites · Vehicles · Toolboxes. Tapping each filters the grid. Empty filter shows "No locations yet".
5. Tap a site card → `LocationDetail` opens, header shows site name. Users tab is active by default. Tap a member → `TeamMemberDetail` opens with their profile + assigned tools. Back twice to dashboard.
6. On `LocationDetail`, switch to Tools tab. Tap a tool → `DeviceDetails` opens (existing screen). Back twice.
7. Repeat 5 for a vehicle card, then a toolbox card. Confirm header tagline reads VEHICLE / TOOLBOX appropriately.
8. Switch top segmented control to Team. Tagline still reads `<ORG> / OFFICE`. Title "Team roster". Stats row shows `—` for ON SITE / HQ (BACKEND_GAP), real number for TOOLS OUT.
9. Quick actions on Team tab: Assign / Export only (Invite/Message NOT shown).
10. Tap a member's "View" → `TeamMemberDetail`. Back.
11. Pull-to-refresh on the dashboard scroll → spinner appears, data reloads.

- [ ] **Step 4: Manual verification — site_worker user**

1. Re-login as `site_worker`. Confirm Dashboard tab still shows the existing `StandardDashboard` (NOT the new office-worker screen).
2. Open Profile (settings tab). Confirm the new "Team" menu row appears for this role.
3. Tap "Team" → `TeamRoster` opens. Header shows `<ORG> / TEAM`, title "Team roster". NO segmented control above (this is the standalone variant).
4. Tap a member → `TeamMemberDetail` opens.

- [ ] **Step 5: Manual verification — admin and owner**

1. Re-login as `admin`. Dashboard tab shows `FleetStatusScreen` (unchanged).
2. Re-login as `owner`. Dashboard tab shows `ControlRoomScreen` (unchanged).
3. Confirm the "Team" menu row in Profile is NOT shown for admin/owner.

- [ ] **Step 6: Push the branch**

```bash
git push -u origin feature/office-worker-dashboard
```

Plan complete.
