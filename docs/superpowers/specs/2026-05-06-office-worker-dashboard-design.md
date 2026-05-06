# Office-Worker Dashboard — Design

**Date:** 2026-05-06
**Status:** Approved (pending user review of this spec)
**Scope:** Office-worker role only. Site-worker dashboard untouched. Owner (`ControlRoom`) and admin (`FleetStatus`) dashboards untouched.

## Problem

Office workers currently fall through to the generic `StandardDashboard` (a flat QuickActions grid + DataOverview). They need a role-specific dashboard that surfaces:

- **Where everything is** — a grid of locations (sites + vehicles + toolboxes) with tool counts and assignee chips, so they can see at a glance where tools are.
- **Who has what** — a roster of teammates with per-person tool counts, so they can find tools by person.

Tapping a location should drill down to that location's assigned users and tools. Tapping a teammate should drill down to that person's assigned tools. The card-list layout is reused for those drill-downs.

## Goals

1. Replace the generic dashboard for `office_worker` role with a two-tab "Where" / "Team" screen.
2. Build reusable card components (`LocationCard`, `MemberCard`, `ToolCard`) that compose into the new dashboard, drill-down screens, and a future site-worker `TeamRoster` entry point.
3. Ship drill-down screens for location detail (Users | Tools tabs) and team-member detail (assigned tools list).
4. Keep the existing `Q` scan FAB present and functional on every screen via the unchanged `MainTabBar`.

## Non-goals

- No changes to owner / admin / site-worker dashboards.
- No changes to bottom tab bar, navigation header behavior, or the role-router shape (we add one branch).
- No new "messaging" feature — the mockup's Message action is dropped for office workers.
- No new "approvals" or "due-date" backend — those banner pieces become `BACKEND_GAP` placeholders.

## Roles in scope

| Role | New behavior |
|---|---|
| `office_worker` | Sees `OfficeWorkerDashboardScreen` (Where / Team tabs). |
| `site_worker` | Unchanged dashboard, but gains a profile-menu link to a standalone `TeamRosterScreen` (same content as the Team tab, no segmented control above). |
| `admin`, `owner` | No change. |

## Architecture (Approach 1 — custom segmented control)

Two-button segmented control at the top of the dashboard parent and the location detail screen, toggling React state to swap the visible tab content. No new dependencies (`@react-navigation/material-top-tabs` was rejected as too heavy for two tabs).

## File layout

```
src/screens/Dashboard/
├── DashboardScreen.tsx                     # role router — add: office_worker → OfficeWorkerDashboardScreen
├── ControlRoom/                            # owner (existing, untouched)
├── FleetStatus/                            # admin (existing, untouched)
├── OfficeWorker/                           # NEW
│   ├── OfficeWorkerDashboardScreen.tsx     # parent: header + segmented control + active tab
│   ├── tabs/
│   │   ├── WhereTab.tsx                    # "Where's everything?" content
│   │   └── TeamRosterTab.tsx               # "Team roster" content
│   ├── components/
│   │   ├── SegmentedTabs.tsx               # reusable 2-tab segmented control
│   │   ├── FilterChips.tsx                 # All · Sites · Vehicles · Toolboxes
│   │   ├── ApprovalsBanner.tsx             # "X pending approvals · Y returns due"
│   │   └── StatsRow.tsx                    # ON SITE / HQ / TOOLS OUT mini-stats
│   ├── hooks/
│   │   ├── useOfficeWorkerWhereData.ts
│   │   └── useOfficeWorkerTeamData.ts
│   └── types.ts
└── shared/
    └── components/
        ├── DashboardHeader.tsx             # existing
        ├── QuickActions.tsx                # existing
        ├── LocationCard.tsx                # NEW
        ├── MemberCard.tsx                  # NEW
        └── ToolCard.tsx                    # NEW

src/screens/
├── TeamRoster/                             # NEW — standalone for site_workers
│   └── TeamRosterScreen.tsx                # thin wrapper around TeamRosterTab
├── LocationDetail/                         # NEW — drill-down for site/vehicle/toolbox
│   ├── LocationDetailScreen.tsx            # Users | Tools tabs (custom SegmentedTabs)
│   └── hooks/useLocationDetail.ts
└── TeamMemberDetail/                       # NEW — drill-down for a person
    ├── TeamMemberDetailScreen.tsx          # profile header + assigned tools card list
    └── hooks/useTeamMemberDetail.ts
```

## Navigation wiring

Role-router change in `DashboardScreen.tsx`:

```tsx
if (role === 'office_worker') return <OfficeWorkerDashboardScreen />;
```

New stack screens in `src/navigation/index.tsx`:

| Route name | Params | Notes |
|---|---|---|
| `LocationDetail` | `{ id: number; kind: 'site' \| 'vehicle' \| 'toolbox' }` | One screen for all three kinds — same layout, different terminology. |
| `TeamMemberDetail` | `{ memberId: number }` | |
| `TeamRoster` | — | Only used as the site-worker entry; office workers reach the same content via the dashboard's Team tab. |

Navigation flows:

```
OfficeWorkerDashboard (Where tab)
  ├─ tap location card     → navigate('LocationDetail', { id, kind })
  └─ tap quick action      → existing screens (AddDevice, AllDevices, etc.)

OfficeWorkerDashboard (Team tab)
  └─ tap member "View"     → navigate('TeamMemberDetail', { memberId })

LocationDetail (Users | Tools)
  ├─ Users tab item        → navigate('TeamMemberDetail', { memberId })
  └─ Tools tab item        → navigate('DeviceDetails', { id })   # existing screen

TeamMemberDetail
  └─ assigned-tool item    → navigate('DeviceDetails', { id })   # existing screen
```

Site-worker access to `TeamRoster`: a "Team" entry on their profile / settings menu navigating to `TeamRoster`. No bottom-tab-bar changes for either role.

The bottom tab bar (`MainTabBar.tsx`) is unchanged; the `Q` scan FAB remains visible on every screen since all the new screens are pushed onto the existing main stack.

## Toolbox modeling

Toolboxes are represented as a sub-type of `site` (option (b) from clarifying questions). The site `kind` is determined by either:
- a `site_type` value from the API filter (`sites.ListSitesFilter` already accepts `site_type`), or
- name-pattern fallback during implementation if the API doesn't expose a clean enum.

Implementation note: the exact mechanism is verified against `docs/api/openapi.json` during the build phase. If neither `site_type` nor a `kind` field exists, treat all sites as `kind: 'site'` and mark toolbox as `BACKEND_GAP` (omit the Toolboxes filter chip and toolbox card kind).

## Data flow

### `useOfficeWorkerWhereData` (Where tab)

| UI element | Source |
|---|---|
| Subtitle "3 sites · 2 vehicles · 1 toolbox" | `sites.listSites().total` (split by kind) + `vans.listVans().total` |
| LOCATIONS heading "21 devices placed" | `assignments.listAssignments({ status: 'active' }).total` |
| Per-site tool count | `assignments.listAssignmentsBySite(siteId).total` |
| Per-vehicle tool count | Same site-assignments call if vans are sites in the API; otherwise **BACKEND_GAP** — show `—` |
| Worker initials chip on card | Distinct `assignee_user` set from active assignments grouped by site |
| Approvals banner: "X pending approvals" | `joinRequests.listJoinRequests().total` if office workers have permission; else **BACKEND_GAP** — hide that side of the banner |
| Approvals banner: "Y returns due" | **BACKEND_GAP** — no due-date concept yet. Hide. |
| Filter chip counts | Derived in-memory from the loaded lists |

### `useOfficeWorkerTeamData` (Team tab + standalone TeamRoster)

| UI element | Source |
|---|---|
| Subtitle "4 members · 8 tools out" | `members.listMembers().total` + total active assignments |
| Stats row ON SITE / HQ | **BACKEND_GAP** — no per-member presence/check-in. Render `—`. |
| Stats row TOOLS OUT | Total active assignments |
| Per-member location + role | `member.assigned_site` (if present) + `member.role` |
| Per-member tool count | One `assignments.listAssignments({ status: 'active' })` call, group client-side by `assignee_user` |
| Per-member "Last scan 08:12" | **BACKEND_GAP** — no per-user last-scan timestamp. Omit the line. |
| Per-member presence dot | **BACKEND_GAP** — omit. |

### `useLocationDetail`

| UI element | Source |
|---|---|
| Header (name, code, kind) | `sites.getSite(id)` for sites/toolboxes; `vans.getVan(id)` for vehicles |
| Users tab list | Distinct assignees from `assignments.listAssignmentsBySite(id)` (or van equivalent) |
| Tools tab list | Items from the same call |

### `useTeamMemberDetail`

| UI element | Source |
|---|---|
| Profile header | `members.getMember(memberId)` |
| Assigned tools list | `assignments.listAssignments({ user: memberId, status: 'active' })` |

### Performance

The Team tab uses one bulk `listAssignments` call grouped client-side by assignee. Avoids N+1 fan-out. Acceptable for org sizes up to a few hundred members; revisit if the page grows beyond that.

### Loading / error / refresh

Same pattern as `ControlRoomScreen` and `FleetStatusScreen`:
- `RefreshControl` for pull-to-refresh on the parent `ScrollView`.
- Hooks expose `{ isLoading, error, refresh }`.
- First-load shows centered `ActivityIndicator` (amber tint).
- Errors render as a small `palette.red` strip above the scroll content.

## Component contracts

All cards live in `src/screens/Dashboard/shared/components/` and use only `palette.ts` tokens (no hard-coded hex).

### `LocationCard`

```ts
interface Props {
  kind: 'site' | 'vehicle' | 'toolbox';
  name: string;
  code: string;
  toolCount: number;
  workerInitials: string[];          // overlapping chips, max 3 visible, "+N" overflow
  hasUnread?: boolean;               // green dot top-right
  onPress: () => void;
}
```

Half-width card (2 per row, 12px gap), 14px radius, `palette.card` bg. Top row: kind icon + uppercase kind label + status dot. Middle: name (white, 17pt, weight 700) + code (muted, 12pt). Bottom: `<count> tools` left, initials chips right.

### `MemberCard`

```ts
interface Props {
  initials: string;
  initialsBg?: string;               // deterministic colour from name hash
  name: string;
  metaPrimary: string;               // e.g. "CHW-04 · Site lead"
  metaSecondary?: string;            // omit when undefined
  toolCount: number;
  onViewPress: () => void;
  presence?: 'online' | 'offline' | null;
}
```

Full-width row, 12px vertical padding, divider at bottom. 44px avatar circle left, name + meta lines middle, `<n> tools` + `View →` button right. Reused on `LocationDetailScreen` Users tab and `TeamMemberDetailScreen` (no `View` button on the latter — props allow omitting).

### `ToolCard`

```ts
interface Props {
  name: string;
  identifier: string;                // serial or code
  status?: string;                   // "Active" | "Maintenance" | etc.
  assigneeName?: string;             // shown when listed from a location, hidden on member detail
  onPress: () => void;
}
```

Full-width row. Icon left, name + identifier middle, status pill + chevron right.

### Sub-components

- `KindBadge` — uppercase pill ("SITE" / "VEHICLE" / "TOOLBOX") with a kind-specific icon.
- `InitialsChipStack` — overlapping initial chips, max 3, `+N` overflow.
- `StatusPill` — coloured pill (`palette.green` / `palette.amber` / `palette.red`).

## Quick actions per role/tab

Office workers only see actions they can perform.

| Tab | Actions | Notes |
|---|---|---|
| Where | Place tool, Move, Assign, Export | Place tool / Move / Assign route to existing scan or assignment flows. Export is **BACKEND_GAP** (no export endpoint) — route to `AllReports` like `FleetStatus` does. |
| Team | Assign, Export | Drop `Invite` (admin/owner-only). Drop `Message` (no messaging feature exists). |

## Empty states

| Screen | Empty copy |
|---|---|
| Where (no locations) | "No locations yet" |
| Team (no members) | "No teammates yet" |
| Location detail Users tab | "No one assigned tools here" |
| Location detail Tools tab | "No tools here yet" |
| Team-member detail | "No tools currently assigned" |

## Testing

### Unit (Jest, `node` env, mock the endpoint modules)

- `useOfficeWorkerWhereData.test.ts` — subtitle counts, per-card tool counts, filter-chip counts, isLoading/error, BACKEND_GAP placeholders.
- `useOfficeWorkerTeamData.test.ts` — bulk-call group-by-assignee aggregation.
- `useLocationDetail.test.ts` — user-list deduplication, tools-list mapping.
- `useTeamMemberDetail.test.ts` — basic shape.

### Pure-helper unit

- Initials extraction from `member.name` (single-word, multi-word, empty).
- Deterministic colour hash for `MemberCard.initialsBg`.
- Filter-chip predicate.

### Component (`@testing-library/react-native`)

- `SegmentedTabs.test.tsx` — labels render, `onChange` fires on press, `accessibilityState.selected` correct.
- `FilterChips.test.tsx` — active styling, `onChange` fires.
- `LocationCard.test.tsx` — kind badge, count, max-3 initials with `+N`.
- `MemberCard.test.tsx` — `metaSecondary` omission, presence-dot omission.
- `ToolCard.test.tsx` — assignee row omission, status-pill colour by status.
- `OfficeWorkerDashboardScreen.test.tsx` — segmented control swaps tabs, navigation called with correct params.

### Integration / smoke

- Extend `DashboardScreen.test.tsx` — `office_worker` role renders `OfficeWorkerDashboardScreen`.
- `LocationDetailScreen.test.tsx` — both tabs render their list, empty states, tool tap navigates.

### Out of scope for tests

Visual styling (manual review on dev client). Material icon glyph names. Navigation library internals.

### Manual verification before claiming done

- Android dev client as `office_worker`: walk every flow — Where tab → tap each kind of card → both detail tabs → tap user → tap tool → back. Then Team tab → tap "View" → drill in.
- Dev client as `site_worker`: confirm `TeamRoster` reachable from profile menu, no segmented control above it.
- Dev client as `admin` and `owner`: confirm `FleetStatus` and `ControlRoom` unchanged.

## Backend gaps (summary)

These all render placeholders and do not block the build:

- Approvals banner "returns due" count — no due-date on assignments.
- Approvals banner "pending approvals" count — depends on whether office workers can list join requests; hide if unauthorized.
- Per-member "Last scan HH:MM" — no last-scan-timestamp field.
- Per-member presence (online/offline) — no presence concept.
- Stats row ON SITE / HQ — no per-member check-in.
- Per-vehicle tool count — depends on whether vans are queryable via `listAssignmentsBySite`; verify during build.
- Toolbox kind — depends on whether `sites` exposes a `kind`/`site_type` enum; otherwise omit the Toolbox filter chip and badge.
- Export quick action — no export endpoint; routes to `AllReports`.
- Team `Invite` / `Message` actions — dropped (admin-only / not implemented).

## Open questions

None. All clarifying questions resolved during brainstorming.
