# Owner Control Room + Admin Fleet Status — Backend Gaps

This document lists every data point on the role-specific dashboards
that the current `/api/v1/` surface cannot satisfy:

- **Owner — Control room** — `src/screens/Dashboard/ControlRoom/ControlRoomScreen.tsx`
- **Admin — Fleet status** — `src/screens/Dashboard/FleetStatus/FleetStatusScreen.tsx`

Each gap renders as `—` (or a sensible fallback) in the UI today,
flagged in source with a `// BACKEND_GAP:` comment. The mobile client is fully
wired to consume the proposed shapes once they ship — no further mobile work
required to "turn on" any of these.

> Existing client integration points referenced below:
> - control room hook: `src/screens/Dashboard/ControlRoom/hooks/useControlRoomData.ts`
> - control room types: `src/screens/Dashboard/ControlRoom/types.ts`
> - fleet status hook: `src/screens/Dashboard/FleetStatus/hooks/useFleetStatusData.ts`
> - fleet status types: `src/screens/Dashboard/FleetStatus/types.ts`
> - generated OpenAPI types: `src/api/generated/schema.ts`

---

## 1. Overdue assignment returns

- **UI location:** Inventory card → `OVERDUE` digit; Attention card → `"N overdue returns"` line; Attention card total.
- **Status:** unsupported. `AssignmentRead` has no due / expected-return field.
- **Proposed schema additions to `AssignmentRead`:**
  ```jsonc
  {
    "expected_return_at": "2026-05-08T17:00:00Z", // nullable
    "is_overdue": true                            // server-computed convenience flag
  }
  ```
- **Proposed listing filter:** `GET /api/v1/assignments/?status=active&overdue=true`
  returning the existing `PagedAssignments` shape so the client can re-use
  `assignmentsApi.listAssignments` without changes.
- **Source of truth (suggested):** new column on `assignments` table populated
  at create-time from a per-org default policy or per-tool category SLA.

## 2. Member activity ("scanning today" / "idle")

- **UI location:** Members card → lines `"3 scanning today"` and `"1 idle"`.
- **Status:** unsupported. `MemberRead` has no `last_active_at`,
  `last_scan_at`, or scan-event aggregation.
- **Proposed schema additions to `MemberRead`:**
  ```jsonc
  {
    "last_scan_at": "2026-05-06T08:14:00Z",      // nullable
    "scan_count_24h": 7,                          // unsigned int
    "is_idle": false                              // bool — server policy: no scan in last 7 days
  }
  ```
- **Alternative (lighter) endpoint:** `GET /api/v1/members/activity/` returning:
  ```jsonc
  { "scanning_today": 3, "idle": 1, "total": 4 }
  ```
  Idempotent, cheap to serve from Redis if scan events are ingested as
  counters. The client would call this in parallel with `listMembers`.
- **Source of truth (suggested):** scan-event log table aggregated nightly
  + a hot 24h counter.

## 3. Compliance percentage + breakdown

- **UI location:** Compliance card → percent number, `"PAT tests due"`,
  `"services overdue"`, `"hires ending today"`.
- **Status:** no compliance domain in the API at all.
- **Proposed endpoint:** `GET /api/v1/organizations/me/compliance/`
  ```jsonc
  {
    "percent": 92,                                // int 0–100, server-computed
    "pat_tests_due": 2,                           // unsigned int
    "services_overdue": 1,                        // unsigned int
    "hires_ending_today": 1,                      // unsigned int
    "components": [                               // optional drill-down
      { "key": "pat", "due": 2, "total": 50 },
      { "key": "service", "overdue": 1, "total": 50 },
      { "key": "hire", "ending_today": 1, "active": 12 }
    ]
  }
  ```
- **Source of truth (suggested):** new tables `tool_inspections`,
  `tool_services`, `tool_hires`. Percent = weighted ratio of in-policy
  records over total applicable.
- **Notes:** the percent should be server-computed so the UI renders one
  authoritative value; do not have the client weight components.

## 4. Notifications / alerts bell badge

- **UI location:** header bell icon — red dot when there is unread activity.
- **Status:** no `notifications` endpoint exists.
- **Proposed endpoint:** `GET /api/v1/notifications/unread/`
  ```jsonc
  { "count": 3, "has_unread": true }
  ```
- **Listing endpoint (for the Alerts screen):**
  `GET /api/v1/notifications/?status=unread|all` → `PagedNotifications`.
- **Source of truth (suggested):** existing internal events bus surfaced as
  per-user notifications.

## 5. Tag count (authoritative)

- **UI location:** Inventory card → `"N TAGS"`.
- **Status:** partially supported. The client computes
  `tools.filter(t => !!t.nfc_tag_id).length` from a single page (200 tools).
  For organisations with > 200 tools the count under-reports.
- **Cleanest fix — add to `OrganizationRead`:**
  ```jsonc
  { "tagged_tool_count": 25 }
  ```
  alongside the existing `tool_count`, `member_count`, `site_count`. This
  fits naturally with the other org rollups already exposed.
- **Alternative:** filter on `listTools`:
  `GET /api/v1/tools/?has_nfc=true&page_size=1` so the client reads the
  `total` field.
- **Mobile change required:** swap the in-memory filter for the new field /
  query — trivial.

## 6. Per-site tool count (authoritative)

- **UI location:** Sites card → `"CHW-04 · 8 tools"`.
- **Status:** computed client-side by grouping active assignments by
  `assignee_site_id`. Counts only tools currently *assigned to a site* —
  tools with no active site assignment are missing.
- **Cleanest fix — add to `SiteRead`:**
  ```jsonc
  { "tool_count": 8 }    // total tools whose home site == this site
  ```
- **Alternative:** `GET /api/v1/sites/{id}/tool-count/` returning
  `{ "count": 8 }`.
- **Mobile change required:** drop the grouping logic, read from `SiteRead`.

## 7. "Audit" feature

- **UI location:** Quick action button `Audit`.
- **Status:** no audit feature exists. Tap currently navigates to
  `AllReports` as a placeholder.
- **Proposed:** define what an audit is (compliance walkthrough? bulk scan
  reconciliation? tool inventory check?) and add the corresponding endpoint
  and screen. Out-of-scope to design here — flagged so it can be triaged.

---

# Admin Fleet Status — Backend Gaps

The Fleet Status dashboard re-uses several gaps from the Control Room
section above (overdue assignments, notifications, authoritative tag count).
The items below are specific to admin views.

## 8. Top exceptions feed

- **UI location:** `TOP EXCEPTIONS · N` list — name, kind, age, detail,
  per-row action button (Chase / Review / Log).
- **Status:** today the list is filled by reading `incidents.listIncidents()`
  client-side and ranking by severity. This means:
  - Overdue assignments cannot appear (no `due_date` on `AssignmentRead`).
  - Assignee names ("Sylvia Williams") are not joined onto incidents.
  - "Service overdue 3d" type details are inferred from `description` text
    rather than a structured field.
- **Proposed endpoint:** `GET /api/v1/fleet/exceptions/?limit=10`
  ```jsonc
  {
    "total": 5,
    "items": [
      {
        "id": "overdue:assignment:42",
        "kind": "overdue",          // overdue | report | maintenance
        "tool_id": 42,
        "tool_name": "Bosch GH-3544",
        "subject_label": "Sylvia Williams",   // assignee, reporter, etc.
        "age_days": 8,
        "detail": "Overdue 8d",
        "severity": "high",         // critical | high | medium | low
        "primary_action": "chase"   // chase | review | log
      }
    ]
  }
  ```
- **Source of truth (suggested):** server-side query that unions:
  - active assignments with `is_overdue=true`
  - open incidents of type damage/critical
  - open incidents of type maintenance
  Ranked by (severity, age_days desc).
- **Mobile change required:** swap the local `buildExceptions` for one
  `apiClient.get('/fleet/exceptions/')` call.

## 9. Multi-segment device-state donut

- **UI location:** Inventory card → coloured donut showing avail / in use /
  maint / missing as proportional arcs.
- **Status:** today rendered as a single-color decorative ring; the segment
  breakdown is shown in the right-hand stats column. The mockup shows a
  multi-segment donut.
- **Blocker:** rendering arbitrary arc segments in pure React Native
  requires `react-native-svg` (or skia). Adding it is a **frontend
  dependency change** (one-time native rebuild of the dev client), not a
  backend gap. Tracked here because the data is already present and only
  the visualisation is missing.
- **Mobile change required when unblocked:** install `react-native-svg`,
  replace the ring in `InventoryDonutCard.tsx` with `<Svg><Circle stroke=...
  strokeDasharray=... /> ...</Svg>`. Data already lives in `FleetInventory`.

## 10. Print-tags flow

- **UI location:** Quick action `Print tags`.
- **Status:** no print/PDF endpoint. Currently routes to `AllDevices`.
- **Proposed:** `POST /api/v1/tools/print-tags/` accepting `{ tool_ids: [...] }`
  and returning a signed PDF URL or a list of NDEF write payloads for
  in-app encoding.

## 11. Export

- **UI location:** Quick action `Export`.
- **Status:** no export endpoint. Currently routes to `AllReports`.
- **Proposed:** `POST /api/v1/exports/` with body
  ```jsonc
  { "type": "fleet" | "exceptions" | "compliance", "format": "csv" | "xlsx" }
  ```
  returning `{ "download_url": "..." }`.

## 12. Per-row action handlers

- **UI location:** `Chase`, `Review`, `Log` buttons on each exception row.
- **Today:** all three currently navigate to the existing
  `ReportDetails` / `DeviceDetails` screens. There is no dedicated:
  - **Chase**: send a reminder to the assignee.
    Proposed: `POST /api/v1/assignments/{id}/chase/` →
    `{ sent_at, channel: "email" | "push" }`.
  - **Log**: record a maintenance log entry.
    Proposed: `POST /api/v1/incidents/{id}/log/` with
    `{ note, mark_resolved?: bool }`.
  - **Review**: nothing new — opens existing report detail screen.

## 13. `Tags used 13/25` denominator

- **UI location:** Inventory card → `Tags used 13/25`.
- **Status:** the mobile client knows how many tools have a tag
  (`13`) but not the **total NFC tag pool** issued to the org
  (`25`). Falls back to `13/—`.
- **Proposed:** add `tag_pool_total` to `OrganizationRead` (or alongside
  `tagged_tool_count` from gap #5), populated from whatever inventory
  system tracks tag-supply purchases.

## 14. Missing-status tracking

- **UI location:** Inventory card → `Missing` row.
- **Status:** today `Missing` is derived from open incidents of type
  `missing|lost|stolen`. There is no first-class "missing" status on the
  tool itself, so a tool reported missing twice (or marked missing without
  an incident) is not represented.
- **Proposed:** make `ToolRead.status` an enum that includes `missing` and
  surface it as a dedicated value the mobile client can group on.

## 15. Tool-detail age in days for exception list

- **UI location:** `8d`, `2d`, `2w`, `3d` chips on exception rows.
- **Status:** computed client-side from `IncidentRead.created_at`. Works
  today but relies on every exception being incident-backed. Once the
  unified `/fleet/exceptions/` endpoint (gap #8) ships, the server should
  return `age_days` directly so the value is consistent across kinds
  (overdue assignments measure age from `expected_return_at`, not
  `created_at`).

---

## Tracking checklist

### Cross-cutting
- [ ] Add `expected_return_at` + `is_overdue` to `AssignmentRead`; support
      `?overdue=true` on `GET /api/v1/assignments/`.
- [ ] Add `last_scan_at` / `is_idle` to `MemberRead`, **or** ship
      `GET /api/v1/members/activity/`.
- [ ] Ship `GET /api/v1/organizations/me/compliance/`.
- [ ] Ship `GET /api/v1/notifications/unread/` and a listing endpoint.
- [ ] Add `tagged_tool_count` and `tag_pool_total` to `OrganizationRead`.
- [ ] Add `tool_count` to `SiteRead`.
- [ ] Decide scope of "Audit" and design endpoints/screens.

### Admin Fleet Status only
- [ ] Ship `GET /api/v1/fleet/exceptions/`.
- [ ] Add `missing` to `ToolRead.status` enum (first-class missing tracking).
- [ ] Ship `POST /api/v1/tools/print-tags/`.
- [ ] Ship `POST /api/v1/exports/`.
- [ ] Ship `POST /api/v1/assignments/{id}/chase/` and
      `POST /api/v1/incidents/{id}/log/`.

### Mobile follow-ups (frontend)
- [ ] Install `react-native-svg` and replace decorative ring in
      `InventoryDonutCard.tsx` with a true multi-segment donut.

After each item ships, regenerate types with `npm run api:types` and the
mobile dashboards will pick up the new fields. The `// BACKEND_GAP:`
comments in `useControlRoomData.ts` and `useFleetStatusData.ts` mark the
exact replacement points.
