# Site-Worker Dashboard + Per-Tab Accent Theming — Design

**Date:** 2026-05-07
**Status:** Approved (pending user review of this spec)
**Branch base:** `feature/office-worker-dashboard` (the office-worker dashboard from the prior cycle)

## Problem

Two related changes:

1. **Site workers** currently fall through to the generic `StandardDashboard`. They need a personal action-oriented dashboard ("Your actions") showing what to do next: returns, due-today rows, flagged checks on their tools, and an end-of-day reminder.
2. The app uses amber for nearly every interactive accent. A user can't tell at a glance which tab they're on, and the app feels visually monotonous. **Per-tab accent theming** assigns each bottom tab a brand-aligned colour (amber, blue, orange, green, violet) that becomes the screen's interactive accent while that tab is focused.

Both ship together: the site-worker dashboard is the proving ground for the theme system, and the office-worker / admin / owner dashboards inherit theming as a bonus.

## Goals

1. Replace the generic dashboard for `site_worker` role with `SiteWorkerDashboardScreen` (Your actions).
2. Add an `AccentContext` that provides each screen with the colour of its focused bottom tab.
3. Refactor existing themed components (`MainTabBar`, `SegmentedTabs`, `FilterChips`, `QuickActions`, `DashboardHeader`) to consume `useAccent()` instead of hardcoding `palette.amber`.
4. Introduce an `ActionButton` for **semantic action colours** (Return = amber, Report = orange, Request = blue, Log = muted) that stay fixed regardless of the active tab.
5. Verify that office-worker, admin, and owner dashboards still render correctly under the theme (they all stay on the Dashboard tab → still amber).

## Non-goals

- No tab-bar layout changes. Bottom tabs keep their current set per role.
- No new entity types. All data comes from existing endpoints.
- No "shift" or "attendance" UI — the client did not buy that module.
- No web/desktop changes; this is the React Native app only.

## Roles in scope

| Role | Behaviour |
|---|---|
| `site_worker` | New `SiteWorkerDashboardScreen` (Your actions). |
| `office_worker` | Unchanged (`OfficeWorkerDashboardScreen` from prior cycle). Inherits Dashboard accent (amber, no visible change). |
| `admin` | Unchanged (`FleetStatusScreen`). Inherits Dashboard accent (amber, no visible change). |
| `owner` | Unchanged (`ControlRoomScreen`). Inherits Dashboard accent (amber, no visible change). |

All roles inherit per-tab accent theming on the OTHER tabs they have (Tools, Incidents/Sites, Settings).

## Per-tab accent mapping

Drawn from the TOOLTRAQ logo (amber, blue, green) and natural extensions:

| Bottom tab | Accent | Hex | Role |
|---|---|---|---|
| Dashboard | Amber | `#FFC72C` | "Home" — primary brand colour |
| Tools / My tools | Blue | `#58A6FF` | TOOLTRAQ wordmark |
| Scan (FAB) | (none — Q-button image) | — | No screen accent; the FAB is a fixed asset |
| Incidents | Orange | `#F97316` | Adjacent to red without screaming alert |
| Sites | Green | `#22C55E` | Logo gradient green |
| Settings | Violet | `#A78BFA` | Cool, low-priority |

`palette.ts` already contains every base hex (`amber`, `blue`, `orange`, `green`, `violet`) and three soft variants (`amberSoft`, `redSoft`, `greenSoft`). Two more soft variants are added: `blueSoft`, `orangeSoft`, `violetSoft`.

## Theming reach (option (b) — tint + primary accent)

Active tab → its accent drives only the **interactive accents**:
- Bottom tab bar active label/icon
- Primary CTA tile (top quick action)
- Segmented control active state
- Filter chip active state
- Header avatar circle bg
- `RefreshControl tintColor`
- Banner accent foregrounds where present

Body text, headings, card backgrounds, dividers, status pills, and **per-action colours** (Return, Report, Request, Log) stay neutral or fixed.

## Action vocabulary (semantic, theme-independent)

Each action has a **fixed** colour wherever it appears (top quick action, per-row CTA, future surfaces):

| Action | Colour token | Endpoint / behaviour |
|---|---|---|
| **Return** | `palette.amber` (`#FFC72C`) | `POST /api/v1/assignments/{id}/return/` |
| **Report** | `palette.orange` (`#F97316`) | navigate `CreateReport` (existing) with current tool context |
| **Request** | `palette.blue` (`#58A6FF`) | navigate to a tool picker → `POST /api/v1/tools/{id}/assign-to-me/` |
| **Log** | `palette.textSecondary` (muted) | navigate `CreateReport` with `type='check'` (or open the existing incident) |
| **Scan** | (Q-button image) | NFC scan modal via `useScanTag()` |

`ActionButton` component takes `actionKind` and resolves to fixed colour. **Drop** Extend (no hire-duration field) and **drop** Close (collapses into Return — same flow, same colour).

## Architecture

### Theming

```
src/theme/
├── tabAccents.ts            # per-tab accent map + types
├── AccentContext.tsx        # provider + useAccent() hook
└── __tests__/
    └── AccentContext.test.tsx
```

`AccentProvider` wraps `NavigationContainer`. It subscribes to navigation state via the container ref's `state` listener. On every state change it walks the state tree to find the currently focused bottom tab and updates its `accent` value. Detail screens pushed onto `MainStack` don't change the bottom-tab focus, so they inherit naturally.

```ts
interface TabAccent {
  key: TabAccentKey;   // 'dashboard' | 'tools' | 'incidents' | 'sites' | 'settings'
  fg: string;          // primary accent colour
  bg: string;          // soft transparent variant
  ink: string;         // dark text colour for use on accent bg
}

useAccent(): TabAccent
```

The default accent (when state is not yet available) is the Dashboard accent (amber).

### Site-worker dashboard

```
src/screens/Dashboard/SiteWorker/
├── SiteWorkerDashboardScreen.tsx      # parent: header + quick actions + log card + action list
├── components/
│   ├── TodayLogCard.tsx               # 3-stat card (CHECKED OUT, RETURNED, OVERDUE)
│   └── ActionRow.tsx                  # row in NEEDS YOUR ACTION list
├── hooks/
│   └── useSiteWorkerData.ts           # composes mine-active + my-incidents + returns-today + EOD trigger
└── types.ts
```

`DashboardScreen.tsx` role router gains:
```tsx
if (role === 'site_worker') return <SiteWorkerDashboardScreen />;
```

### ActionButton

```
src/screens/Dashboard/shared/components/ActionButton.tsx
src/screens/Dashboard/shared/components/__tests__/ActionButton.test.tsx
```

```ts
type ActionKind = 'return' | 'report' | 'request' | 'log' | 'scan';

interface Props {
  kind: ActionKind;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'compact';   // primary = quick-action tile; compact = row CTA
  onPress: () => void;
}
```

Resolves a fixed `{ fg, bg }` per kind from a private map. Used by `QuickActions`-style top tiles AND per-row CTAs.

## Site-worker dashboard composition

### Header

`<DashboardHeader>` (existing, theme-aware):
- **Tagline**: `<SITE_PREFIX> / <SITE_NAME>` from the user's currently active `SiteAssignment` (e.g. `CHW-04 / CHELSEA WHARF`). If user has no active site assignment, fall back to `<ORG> / SITE`.
- **Title**: `Your actions`
- **Subtitle**: `What needs your attention today`
- Right side: bell icon (alerts) + amber initials avatar (Dashboard accent → amber).

### Top quick actions (4 tiles, top-row of dashboard)

| Tile | Kind | Behaviour |
|---|---|---|
| **Return** (primary) | `return` (amber, primary tile) | Opens NFC scan; on read, finds matching active assignment → `POST /api/v1/assignments/{id}/return/` |
| **Report** | `report` (orange) | Navigates `CreateReport` |
| **Request** | `request` (blue) | Navigates a tool picker (existing `AllDevices` filtered by available) → `POST /api/v1/tools/{id}/assign-to-me/` |
| **My tools** | (neutral) | Navigates to the Tools tab |

Note: drop Extend (no API field). The 4th tile becomes "My tools" — a quick path to inventory.

### TODAY'S LOG card

3-cell stat card. NO shift line (out of scope — client didn't buy attendance module).

| Cell | Source |
|---|---|
| **CHECKED OUT** | `assignments.listMyActiveAssignments().length` |
| **RETURNED** | `assignments.listMyAssignments({ status: 'returned' })`.items filtered by `returned_at === todayISO` |
| **OVERDUE** | active assignments where `expected_return_at && expected_return_at < todayISO && !returned_at` |

If RETURNED endpoint returns paged data, the count uses `total` if reliable; otherwise length-of-filtered-items.

### NEEDS YOUR ACTION list

A unified `ActionRow[]` rendered in priority order:

1. **Overdue assignments** — `expected_return_at < todayISO`. Subtitle: `Return overdue · X days`. CTA: `Return` (amber).
2. **Due-today assignments** — `expected_return_at === todayISO`. Subtitle: `Return due today`. CTA: `Return` (amber).
3. **Flagged incidents** on my tools — `incidents.listMyIncidents()` filtered to open severities. Subtitle: incident type/description, one line. CTA: `Log` (muted, opens incident detail).
4. **End-of-day return** (synthetic, single row) — appears when:
   - Local clock ≥ 16:00, AND
   - User has ≥ 1 active assignment where `assignee_site_id` is a `site` of `site_type === 'vehicle'`.
   - Subtitle: `Scan N items back to <VAN_PREFIX>`. CTA: `Scan` (Q-button colour).

Empty state: "All caught up — nothing to action right now."

### Sort order

Within the list:
- All overdue first (most-overdue → least-overdue by days).
- Then due-today.
- Then flagged incidents (by created_at desc).
- EOD row always last.

## Data flow

`useSiteWorkerData`:

```ts
interface SiteWorkerData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;

  // Header
  organizationName: string;
  siteTagline: string;          // "CHW-04 / CHELSEA WHARF" or fallback
  userInitials: string;
  hasUnreadAlerts: boolean | null;

  // Today's log
  checkedOut: number;
  returnedToday: number;
  overdueCount: number;

  // Action list
  rows: ActionRow[];
}

interface ActionRow {
  id: string;                   // unique key (e.g. "overdue-{assignmentId}")
  kind: 'overdue' | 'due_today' | 'flagged' | 'eod';
  iconName: keyof typeof Ionicons.glyphMap;
  iconTint?: string;            // small colour cue on the row icon
  primary: string;              // headline ("Bosch GH-3544", "End-of-day return")
  secondary: string;            // sub-line ("Return overdue · 4 days")
  cta: { kind: ActionKind; label: string };
  payload: { assignmentId?: number; incidentId?: number; toolId?: number };
}
```

API calls (single bulk fetch in `Promise.all`):
- `assignments.listMyActiveAssignments()` — array, not paged.
- `assignments.listMyAssignments({ status: 'returned' })` — paged.
- `incidents.listMyIncidents()` — paged.
- `sites.listSites({ site_type: 'vehicle' })` — paged. Used to recognise van-typed sites in active assignments. (`page_size: 200` — vans are few.)
- `siteAssignments.listSiteAssignments({ user: <me> })` — paged. Used for header tagline.
- `organizations.getMyOrganization().catch(() => null)` — for org name fallback.

Date math is local-day comparison: `today = new Date().toISOString().slice(0,10)` works for UTC; for org-local correctness, the server hasn't agreed a tz contract yet, so we treat dates as date-only strings and compare lexically (ISO sorting works for `YYYY-MM-DD`). `BACKEND_GAP:` org-local-day handling — comment in the hook.

## File layout

```
src/theme/                                           # NEW
├── tabAccents.ts
├── AccentContext.tsx
└── __tests__/
    └── AccentContext.test.tsx

src/screens/Dashboard/
├── DashboardScreen.tsx                              # MODIFY: add site_worker branch
├── SiteWorker/                                      # NEW
│   ├── SiteWorkerDashboardScreen.tsx
│   ├── components/
│   │   ├── TodayLogCard.tsx
│   │   └── ActionRow.tsx
│   ├── hooks/
│   │   └── useSiteWorkerData.ts
│   ├── types.ts
│   └── __tests__/                                   # screen + components + hook tests
└── shared/
    ├── palette.ts                                   # MODIFY: add blueSoft, orangeSoft, violetSoft
    └── components/
        ├── ActionButton.tsx                         # NEW
        ├── DashboardHeader.tsx                      # MODIFY: avatar uses accent
        └── QuickActions.tsx                         # MODIFY: primary tile uses accent
                                                     #         (alt: replace primary tiles with ActionButton)

src/screens/Dashboard/OfficeWorker/components/
├── SegmentedTabs.tsx                                # MODIFY: active state uses accent
└── FilterChips.tsx                                  # MODIFY: active state uses accent

src/navigation/
└── MainTabBar.tsx                                   # MODIFY: per-tab accent on active label/icon
```

## Component refactor scope

| Component | Change |
|---|---|
| `MainTabBar.tsx` | The active tab's `tint` becomes `tabAccents[tab.key].fg` instead of `colors.primary`. Inactive stays `colors.textMuted`. |
| `SegmentedTabs.tsx` | `tabActive` bg = `accent.fg`, label colour = `accent.ink`. |
| `FilterChips.tsx` | `chipActive` bg = `accent.bg`, border = `accent.fg`, label = `accent.fg`. |
| `QuickActions.tsx` | `tilePrimary` bg = `accent.fg`, primary icon/label = `accent.ink`. (For site-worker dashboard, the primary tile is a `Return` ActionButton — pinned to amber, NOT accent. So `QuickActions` only uses accent when the caller's primary action is "general home action" — which today is only office-worker's Place tool / admin's Add device. Confirm during implementation that primary-tile colour follows accent rather than action semantics.) |
| `DashboardHeader.tsx` | avatar bg = `accent.fg`, avatar text = `accent.ink`. |
| All `RefreshControl` instances | `tintColor={accent.fg}` (replacing the four hard-coded `palette.amber` tints). |

Important nuance for `QuickActions`: today's "primary tile" semantics are mixed. On the office-worker dashboard, the primary tile is "Place tool" — a generic home action that should follow the tab accent. On the site-worker dashboard, the primary tile is "Return" — a semantic action that should always be amber regardless of accent. Resolution: `QuickActions` props gain an optional `primaryActionKind?: ActionKind`. If set, the primary tile renders as an `ActionButton` with that kind's fixed colour. If not set, it falls back to current behaviour (use `accent.fg`). This keeps both call sites correct.

## Backend gaps (summary)

- **Org-local "today"** — date math is naive UTC for now; comment in the hook so a future locale fix is obvious.
- **Returns count `total`** — `assignments/mine/?status=returned` is paged; rely on filtered-items count if `total` doesn't match the day-filtered set.
- **EOD synthetic row trigger time** — hard-coded `EOD_HOUR = 16`; later move to org settings.
- **Incident type taxonomy** — `Log` action navigates to `CreateReport` with `type='check'` if the API accepts that string; else use the closest existing type.
- **Tool picker for Request** — the existing `AllDevices` screen is reused as the picker for now; later add a dedicated `RequestTool` flow.

## Testing

### Unit (Jest, `node` env)

- `tabAccents.test.ts` — every tab key maps to a valid `{fg, bg, ink}` triple; types are exhaustive.
- `AccentContext.test.tsx` — provider returns Dashboard accent by default; updates when navigation state changes; `useAccent()` outside provider returns Dashboard accent (no crash).
- `useSiteWorkerData.test.ts` — given fixture mine-active + incidents + sites + site-assignments, verifies counts, action rows, and EOD trigger conditions. Mocks all five endpoints. Covers:
  - Overdue rows by `expected_return_at < today`.
  - Due-today rows by `expected_return_at === today`.
  - EOD shown only when local hour ≥ 16 AND a van-assigned tool exists.
  - Empty state when no rows.
  - Tagline fallback when no active site assignment.

### Component (`@testing-library/react-native`)

- `ActionButton.test.tsx` — renders fixed colour per kind; calls `onPress`; `compact` vs `primary` variant styling.
- `TodayLogCard.test.tsx` — renders 3 stats; OVERDUE cell uses `palette.red` foreground.
- `ActionRow.test.tsx` — renders headline + subtitle + correct CTA per row kind; calls handler.
- `SiteWorkerDashboardScreen.test.tsx` — extends the `DashboardScreen.test.tsx` role-router pattern. Add `site_worker` test asserting the new screen renders.

### Integration / smoke

- Extend `DashboardScreen.test.tsx` — the existing `site_worker` test (currently passes against `StandardDashboard`) is replaced with one asserting the new `SiteWorkerDashboardScreen` renders (Your actions title, Return tile, etc.).
- Existing `OfficeWorkerDashboardScreen.test.tsx` and dashboard component tests should still pass, with one tweak: tests that asserted hard-coded `palette.amber` colours need to render inside an `AccentProvider` set to Dashboard accent — same colour, same outcome.

### Manual verification (real Android dev client)

For each role:
1. Tab through Dashboard / Tools / Sites / Incidents / Settings — confirm the tab bar's active label takes the matching accent.
2. On the Dashboard tab, confirm primary CTAs are amber (existing behaviour preserved).
3. Push a stack screen from the Dashboard (e.g. office-worker drills into LocationDetail) — confirm SegmentedTabs and FilterChips inside still use amber (Dashboard tab still focused).
4. Switch to Tools tab — confirm anything themed there (e.g. an active filter chip) becomes blue.
5. Specifically for site_worker: walk Return / Report / Request / My tools tiles. Walk an overdue row's Return CTA. Confirm the EOD synthetic row appears after 16:00 local with a van-assigned tool.

## Out of scope for this spec

- Adding `expected_return_at` UI to the office-worker dashboard's Place tool / Move flows — separate feature.
- Server-side `is_overdue` / `days_overdue` exposure — backlog item the user already noted.
- Org-local timezone handling — see backend gap.
- Hire / Close / Extend semantics — wait for a hire entity on the API.

## Open questions

None. All clarifying questions resolved during brainstorming.
