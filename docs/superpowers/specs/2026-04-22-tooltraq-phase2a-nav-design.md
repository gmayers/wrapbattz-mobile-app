# TOOLTRAQ Phase 2a — Nav Restructure Design

**Date:** 2026-04-22
**Branch:** `feature/tooltraq-phase2a-nav` off `master`.
**Relationship to other work:**

- Builds on Phase 1 (PR #5, merged 2026-04-20 — rebrand, theme tokens, bug fixes).
- Independent of the API v1 migration running in parallel (see `memory/project_api_v1_migration.md`). Phase 2a is **structural/UI-only**; data wiring to new `api.tooltraq.com/api/v1/` endpoints lands when API migration Phases 4–6 ship.
- Phase 2b (dashboard polish + History tab as distinct screen + vehicle/toolbox site-type UI) is deferred to its own spec.

## Goals

1. Restore universal-link routing regressed from Phase 1 — NFC taps must re-open the app at `QuickActionModal`.
2. Replace the current 5-tab bottom nav (`Dashboard | Reports | Locations | Profile | Logout`) with a role-adaptive 2-FAB-2 layout featuring an elevated center Scan button.
3. Adopt new API terminology in user-visible labels: **Tools** (was Devices), **Sites** (unchanged but promoted), **Incidents** (was Reports).
4. Establish a clean module structure per tab so Phase 2b and API v1 migration Phases 4–6 can extend without restructuring.

## Non-goals

- Dashboard visual redesign matching mockup Image #2 (stat-card polish, recent-activity feed, avatars) — Phase 2b.
- Distinct "History" tab with real history content — Phase 2b (workers see Incidents in the mockup's History slot in Phase 2a).
- Vehicle/toolbox site-type UI differentiation — needs backend support first.
- Wiring Tools/Sites/Incidents screens to `api.tooltraq.com/api/v1/` endpoints — Phase 2a uses stubs or remaining legacy surfaces; API migration Phases 4–6 wire real data.
- Terminology rename *outside* the new nav surfaces. Older screens keep existing labels until API v1 migration lands.
- office_worker vs site_worker nav differentiation — both roles get the same tab set.

## Design

### Final tab layout

Bottom nav is 5 slots, center slot is an elevated FAB Scan button:

| Slot | Worker (office_worker / site_worker) | Admin / Owner |
|---|---|---|
| 1 | Dashboard | Dashboard |
| 2 | Tools | Tools |
| 3 (FAB) | **Scan** | **Scan** |
| 4 | Incidents | Sites |
| 5 | Settings | Settings |

### Linking regression fix (first commit of branch)

`src/navigation/index.js` currently has no `linking` config — NFC taps that launch via universal link won't route to `QuickActionModal`. Rename to `index.tsx` and restore:

```ts
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'https://api.tooltraq.com',
    'https://webportal.battwrapz.com',
    'tooltraq://',
    'wrapbattz://', // legacy fallback
  ],
  config: {
    screens: {
      QuickActionModal: 'd/:tagUID',
    },
  },
};
```

Also re-register as Stack screens: `QuickActionModal` (modal presentation), `VehicleDetailsScreen` (push).

Keep TypeScript conversion minimal — just enough to type `linking`.

### `src/navigation/mainTabs.ts` — declarative tab config

```ts
export type TabKey = 'dashboard' | 'tools' | 'scan' | 'incidents' | 'sites' | 'settings';
export type Role = 'owner' | 'admin' | 'office_worker' | 'site_worker';

export interface TabConfig {
  key: TabKey;
  label: string;
  icon: string;          // Ionicons unfocused
  iconFocused: string;   // Ionicons focused
  isFab?: boolean;
  component?: React.ComponentType;
}

const ALL_TABS: Record<TabKey, TabConfig> = {
  dashboard: { key: 'dashboard', label: 'Dashboard', icon: 'home-outline',          iconFocused: 'home',          component: DashboardScreen },
  tools:     { key: 'tools',     label: 'Tools',     icon: 'construct-outline',     iconFocused: 'construct',     component: ToolsScreen     },
  scan:      { key: 'scan',      label: 'Scan',      icon: 'scan-circle-outline',   iconFocused: 'scan-circle',   isFab: true                },
  incidents: { key: 'incidents', label: 'Incidents', icon: 'document-text-outline', iconFocused: 'document-text', component: IncidentsScreen },
  sites:     { key: 'sites',     label: 'Sites',     icon: 'business-outline',      iconFocused: 'business',      component: SitesScreen     },
  settings:  { key: 'settings',  label: 'Settings',  icon: 'settings-outline',      iconFocused: 'settings',      component: SettingsScreen  },
};

export function tabsForRole(role: Role | undefined): TabConfig[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  const keys: TabKey[] = isAdminOrOwner
    ? ['dashboard', 'tools', 'scan', 'sites', 'settings']
    : ['dashboard', 'tools', 'scan', 'incidents', 'settings'];
  return keys.map(k => ALL_TABS[k]);
}
```

Undefined role defaults to the worker layout (safer while role loads post-login).

### `src/navigation/MainTabBar.tsx` — custom tab bar

Renders the 5-slot layout by consuming `BottomTabBarProps` from `@react-navigation/bottom-tabs`.

- Horizontal row of 5 flex-1 slots
- Regular tabs: column layout (icon on top, label below), tint `colors.primary` focused, `colors.textMuted` unfocused
- FAB slot: `View` with `marginTop: -20` offset so the circle protrudes above the tab bar baseline
- FAB: 64×64 circle, `backgroundColor: colors.primary`, icon color `colors.onPrimary`, soft shadow/ring
- FAB label "Scan" below, primary color
- Tab bar bg: `colors.surface`; top hairline border: `colors.border`
- Bottom padding: `insets.bottom` + platform-specific value (follows existing TabNavigation pattern)
- Regular tab `onPress`: calls `navigation.emit('tabPress', ...)` via the default behavior
- FAB `onPress`: invokes `props.onScanPress` (injected via render prop — see below) — **never** calls `navigation.navigate('scan')` because the Scan "tab" has no screen

Accessibility:

- Each tab: `accessibilityRole="button"`, `accessibilityLabel={tab.label}`, `accessibilityState={{ selected }}`
- FAB: `accessibilityLabel="Scan NFC tag"`, `accessibilityHint="Starts the NFC reader to scan a tool"`
- Minimum 44×44 touch target for regular tabs, 64×64 for FAB

### `MainTabNavigator` — replaces `TabNavigation.js`

- Uses `createBottomTabNavigator()` from `@react-navigation/bottom-tabs`
- Registers the 4 non-FAB tabs only (Scan is FAB-only, no screen)
- `tabBar` prop renders `<MainTabBar {...props} onScanPress={handleScanPress} />`
- `handleScanPress` lives in this component: invokes `nfcService.readSingleTag()`, on success calls `navigation.navigate('QuickActionModal', { tagUID })`, on failure `Alert.alert`, on cancel dismisses silently
- No Logout tab — moved to Settings as a destructive action row

### `src/screens/Dashboard/`

**`DashboardScreen.tsx`** — ScrollView with:

1. `QuickActionsGrid.tsx` — 2-column grid of action tiles read from `quickActions.ts`:
   - Workers (4 tiles): Scan | Report Issue | My Tools | Notifications
   - Admins/Owners (8 tiles): Scan | Report Issue | My Tools | Notifications | Add Tool | Sites | Invite User | Billing
   - Each tile: Ionicons icon + label; `colors.surface` background; press animates to `colors.primaryTint10`
2. `DataOverview.tsx` — role-adaptive stats:
   - Workers (3 chips): `Tools Assigned` · `Open Incidents` · `Sites`
   - Admins/Owners (4 cards matching mockup Image #2 layout): `Active Tools` · `In Use` · `Missing` · `Maintenance Due`
   - Data sourced from `useDashboardStats()` hook — Phase 2a returns `{ isLoading: true, stats: {} }` until API v1 Phase 4/5 lands
   - Loading state renders skeleton shimmers; if legacy endpoint exists, hook falls back to legacy data

### `src/screens/Tools/`

**`ToolsScreen.tsx`** — `SectionList` grouped by site:

- Header: search `TextInput` + (admins/owners only) `AdminToolsToggle` — "My Tools" / "All Org Tools"
- Sections: one per site the user is assigned to; section header = `SiteGroupHeader` showing site name + type icon (📍 location / 🚐 van / 🧰 toolbox)
- Rows: `ToolsListItem` — tool identifier, tool type, assignment-status chip; tap → `navigation.navigate('ToolDetails', { toolId })` (routes to existing `DeviceDetailsScreen` during Phase 2a)
- Empty state: "No tools yet. Tap Scan to check a tag."
- Data from `useMyTools()` hook: Phase 2a stub returns `{ isLoading: false, items: [] }`; real data wires when API v1 Phase 4 lands

### `src/screens/Sites/` (admins/owners only)

**`SitesScreen.tsx`** — thin wrapper re-exporting existing `LocationsScreen` content. No logic change in Phase 2a. Directory exists so Phase 2b / API v1 Phase 5 can evolve Sites without touching tab config.

### `src/screens/Incidents/` (workers only)

**`IncidentsScreen.tsx`** — thin wrapper re-exporting existing `ReportsScreen` content. Header label reads "Incidents". Directory exists for the same rationale.

### `src/screens/Settings/`

**`SettingsScreen.tsx`** — `SectionList` rendering sections from `sections.ts`:

```ts
export type RoleGate = 'admin' | 'owner' | 'all';

export interface SettingsRow {
  key: string;
  label: string;
  icon: string;                     // Ionicons
  kind: 'nav' | 'action' | 'themePicker';
  destination?: string;             // screen name for kind: 'nav'
  onPress?: (ctx: { navigation; logout }) => void;  // for kind: 'action'
  destructive?: boolean;
}

export interface SettingsSection {
  key: string;
  title: string;
  requiredRole: RoleGate;           // 'all' = every role
  rows: SettingsRow[];
}

export function getSectionsForRole(role: Role | undefined): SettingsSection[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  return ALL_SECTIONS.filter(s => s.requiredRole === 'all' || isAdminOrOwner);
}
```

Sections (declared in order):

1. **Account** — Profile (→ EditProfile), Change Password (→ ChangePassword), Biometric & PIN (→ new `SecurityPreferences` screen extracted from ProfileScreen)
2. **Preferences** — Notifications (→ NotificationPreferences), Theme (inline segmented control row — System / Light / Dark; no separate screen needed since the choice is 3 options)
3. **Organization** *(admin/owner only)* — Org Details, Members, Invite Code
4. **Billing** *(admin/owner only)* — Manage Billing, Payment History, Data Handling Fee, Billing Analytics
5. **Support** — Suggest a Feature, About (version info), Terms, Privacy
6. **Logout** — single destructive row; calls `logout` via AuthContext then resets nav to Login

One screen, role-filtered at render. ProfileScreen's existing content splits: profile info moves to `EditProfile`; billing-admin sections become Settings rows linking to `PaymentScreens/*`; biometric/PIN setup extracts into `SecurityPreferences`.

### Scan FAB flow

```
FAB tap
  → MainTabNavigator.handleScanPress()
  → nfcService.readSingleTag()  // iOS system sheet / Android app overlay
    ↓
  result = { success: true, tagUID }  |  { success: false, error, cancelled }
    ↓
  success → navigation.navigate('QuickActionModal', { tagUID })
  cancelled → silent dismiss
  failure → Alert.alert('NFC read failed', error)
```

**QuickActionModal compatibility during Phase 2a:** the screen currently calls methods that were removed from the AuthContext compat shim (`deviceService.getDeviceByNfcUuid`, `getLocations`, `getVans`, `returnDeviceToLocation`). Phase 2a adds `src/services/legacyDeviceShim.ts` which exposes these methods as graceful stubs (return empty + user-friendly "This feature is being migrated — tap registered" alert). The shim is replaced by real calls in API v1 Phase 4/5.

Alternative: if by implementation time API v1 Phase 4/5 endpoints are live, wire QuickActionModal directly and skip the shim. Plan step 2a-09 (QuickActionModal revival) checks status at execution time.

## Architecture notes

- **Isolation**: each tab has one directory with one screen file, its own `components/`, its own `hooks/`. No cross-tab imports except via shared theme/auth contexts.
- **No god-files**: every new file targets ≤ 200 LOC. If a new file exceeds 300 LOC during implementation, stop and split (flagged as a `DONE_WITH_CONCERNS` signal in the subagent pattern).
- **Phase 2b entry points**: `DashboardScreen.tsx`'s two children (`QuickActionsGrid`, `DataOverview`) are both swappable in Phase 2b without touching the tab bar. Same for `IncidentsScreen.tsx` becoming a real History screen.
- **Backwards compatibility**: `MainTabs` name preserved so existing Stack.Screen pushes continue to work. Existing detail screens (`ToolDetails` ← `DeviceDetails`, `SiteDetails` ← `LocationDetails`, etc.) stay in the Stack unchanged.

## Testing

**Unit tests** (new in Phase 2a):

- `src/navigation/__tests__/mainTabs.test.ts` — `tabsForRole()` returns 5 tabs for each of the 4 roles, in the right order, FAB in slot 3
- `src/navigation/__tests__/MainTabBar.test.tsx` — renders 4 regular tabs + 1 FAB, `onScanPress` invoked on FAB press, focused/unfocused tint correct, labels present
- `src/screens/Settings/__tests__/sections.test.ts` — `getSectionsForRole()` filters Organization + Billing out for workers, includes them for admin/owner
- `src/screens/Dashboard/__tests__/DashboardScreen.test.tsx` — workers render 4 Quick Action tiles + 3 stat chips; admins render 8 tiles + 4 stat cards

**Integration-light smoke tests:**

- `MainTabNavigator` mount with mocked role — each tab's screen renders without crashing
- Scan FAB: mock `nfcService.readSingleTag` resolving success → verify `navigation.navigate('QuickActionModal', { tagUID })` called

**Deferred:**

- Full NFC e2e (requires physical device)
- Visual regression / screenshot tests

## Migration sequence

Commits on the branch should land in this order to keep each revertable:

1. Linking regression fix (`src/navigation/index.tsx` — restore `linking` + Stack.Screen registrations)
2. `mainTabs.ts` + `MainTabBar.tsx` (additive, not yet used)
3. New tab screen shells (Dashboard, Tools, Incidents, Sites, Settings — additive, not yet routed)
4. `legacyDeviceShim.ts` + QuickActionModal revival
5. Swap `TabNavigation` → `MainTabNavigator` in `src/navigation/index.tsx` — single commit that flips the user-visible nav; revertable alone
6. Delete `src/navigation/TabNavigation.js` and `src/screens/HomeScreen/` (cleanup)

Reverting commit 5 alone is enough to fall back to the old nav if a problem is discovered after merge.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| API v1 migration Phase 4/5/6 slower than Phase 2a ships → stub data in Tools/Sites/Incidents | Explicit scope: Phase 2a is structural. Screens show "connecting" placeholders rather than errors. |
| QuickActionModal crashes post-merge (pre-existing master regression) | `legacyDeviceShim.ts` catches removed-method calls; shows user-friendly alert rather than crash. |
| Role undefined briefly post-login | `tabsForRole(undefined)` defaults to worker layout (safer — hides admin tabs until role resolves). |
| iOS FAB partly obscured by home indicator | `paddingBottom: insets.bottom + 16` on tab bar; FAB positioned above tab content. Re-verified in on-device acceptance. |
| Large PR hard to review | 6-commit migration sequence above makes each commit independently reviewable. |

## Acceptance criteria

Ship-gate checks:

- [ ] NFC tap on a registered tag re-opens the app and lands on `QuickActionModal` (universal link regression fixed)
- [ ] Workers (`site_worker` or `office_worker`) see `Dashboard | Tools | Scan | Incidents | Settings`
- [ ] Admins/Owners see `Dashboard | Tools | Scan | Sites | Settings`
- [ ] Center FAB Scan tap starts NFC reader and on success routes to `QuickActionModal`
- [ ] Settings renders Organization + Billing sections only for admin/owner
- [ ] Logout accessible from Settings → Logout row, not a tab
- [ ] Dashboard Quick Actions grid renders role-correct tile count (4 / 8)
- [ ] Tab bar and FAB render correctly in both light and dark mode
- [ ] Old `TabNavigation.js` and `HomeScreen/` removed from source tree
- [ ] All new test files pass (`npm test`); pre-existing baseline unchanged

## Manual / out-of-band steps

None expected — Phase 2a is entirely in-code. No EAS re-init, no external service config, no asset changes.
