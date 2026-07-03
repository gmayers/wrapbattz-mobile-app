# QA Round 4 — Mobile Fixes (Live Onboarding Feedback)

**Date:** 2026-07-03
**Branch:** `qa-round4-mobile` (off master post-PR #8 merge)
**Source:** Live-onboarding QA feedback, 2026-07-03.

## Scope decision

Most of the round-4 QA list targets the **web portal** (Django repo `gmayers/tooltraq`):
profile photo corruption, Add Tool icon/bulk upload/insurance register, invite failure
message, history download 500, PDF upgrade gating, audit CSV, Rentals, Servicing,
temporary access. Per user direction this session handles **mobile-only** items; the
web-portal list is handed to a separate session (see "Out of scope" below).

One approved exception: item 1 needs a small backend API change because the v1 Tool
schemas don't expose fields the mobile bug depends on.

## Items

### 1. Service interval / next-due / condition display (bug, end-to-end)

**Problem.** Entering a 90-day maintenance interval produces no "next service due" on
the devices screen, and Condition renders a dash. Two stacked causes:

- **API gap (root cause):** backend `Device` has `maintenance_interval_days`,
  `next_maintenance_date`, `warranty_expiry`, `purchase_date`, `purchase_cost`,
  `condition_score` — but v1 `ToolRead` exposes none of them and
  `ToolCreate`/`ToolUpdate` accept none. Mobile sends maintenance fields that the API
  silently drops.
- **Mobile field-name mismatch:** render sites read `device.next_maintenance` while the
  canonical name is `next_maintenance_date` (`StandardDeviceCard.js:39-42`,
  `DeviceDetailsScreen.js:450-453`, `ModalComponents.js:212-215`).

**Backend change** (branch off `origin/master` in `gmayers/tooltraq`, own PR):

- `devices/schemas.py`: `ToolRead` += `maintenance_interval_days: Optional[int]`,
  `next_maintenance_date: Optional[date]`, `warranty_expiry: Optional[date]`,
  `purchase_date: Optional[date]`, `purchase_cost: Optional[Decimal]`,
  `condition_score: Optional[Decimal]`. `ToolCreate`/`ToolUpdate` +=
  `maintenance_interval_days`, `next_maintenance_date` (write scope limited to
  maintenance; lifecycle/purchase editing stays portal-side).
- `api/routers/tools/tools.py`: `_serialize` maps the new fields; create/patch persist
  the two writable ones.
- Router tests for round-trip create→read and patch.
- Regenerate `docs/api/openapi.json` in the mobile repo + `npm run api:types`.

**Mobile change:**

- Read `next_maintenance_date` (fallback `next_maintenance` for stale NFC-tag payloads)
  at the three render sites.
- `AddDeviceScreen`: send `maintenance_interval_days`; when the user enters an interval
  and has not manually picked a date, auto-set `next_maintenance_date = today + interval`.
- Condition: map `condition_score` → label: `null → "OK"`, `>7 → "Good"`,
  `>4 → "Fair"`, `≤4 → "Poor"` (thresholds follow backend `lifecycle.py`, which flags
  `≤4` as low-condition). Render the label instead of a dash.
- Unit tests: label mapping, next-date computation.

**Graceful degradation:** until the backend PR deploys, the new fields are absent from
responses; render sites must treat `undefined` as today (hide row / show "OK"), so the
mobile change is safe to ship first.

### 2. "Find Tool" quick action + tools search (UX)

`ToolsScreen.tsx` has no search. Add a search input filtering the fetched list by
name/serial/make/model (case-insensitive substring, plain-code filter in
`useMyTools`/screen). Accept a `focusSearch` route param to autofocus. Add a
**Find Tool** quick-action tile for the standard dashboard (`quickActions.ts`,
`destination: 'MainTabs', params: { screen: 'tools', params: { focusSearch: true } }`)
and the equivalent entry on the admin/owner dashboards if their tile lists are separate
(ControlRoom/FleetStatus).

### 3. In-app invite composer (gap)

The "Invite User" quick action and Settings row navigate to `MembersScreen`, which has
no invite UI — `createInvitation` is only reachable inside onboarding. Add to
`MembersScreen`: an "Invite" button opening a small composer (email + role picker →
`POST /invitations/`), a pending-invitations section (list, resend, revoke) using the
existing `src/api/endpoints/invitations.ts` wrappers, and failure alerts with retry.
This is the mobile analog of the QA invite complaints (the exact reported failure was
portal-side, but mobile currently can't send invites at all).

### 4. Label rename: "Assign Device" → "Assign Tool" (UX)

User-facing strings only (TOOLTRAQ vocabulary is "tools"): `HomeHeader.js`,
`AssignDeviceModal.js` title, `QuickActionModalScreen.tsx` labels, and other visible
"device" strings on the home/locations flows encountered while editing. No route,
file, or identifier renames (OTA-safe, low-risk).

### 5. Category "+ Add new" in Add Tool (UX)

The category dropdown is a closed hardcoded list (`src/constants/deviceCategories.ts`).
Append a "+ Add new…" option that reveals a text input. Submit keeps the existing
contract: send matched `category_id` when the name matches a fetched backend category,
else send `category: <name>` (pending backend contract from round 3), else null.

## Out of scope (deferred, with reasons)

- **Social logins on mobile** — blocked: backend `feat/mobile-google-signup-onboarding`
  branch exists but is unmerged/undeployed. Needs its own spec once the backend contract
  is live.
- **Tool history download + history 500** — the 500 is backend
  (`GET /tools/{id}/history/`); export UI belongs with that fix.
- **Return flow photo upload + condition capture** — feature addition; pairs with the
  condition model above but needs UX design.
- **Purchase date/cost + insurance register on mobile Add Tool** — portal redesign will
  settle the section layout first; ToolRead now exposes the fields read-only.
- **Temporary/contractor access with expiry** — needs new backend schema
  (`MemberRead` has no expiry; closest primitive is SiteAssignment `end_date`).
- **Sectionizing the mobile Add Tool form** — deferred by decision (web-first).
- **Entire web-portal QA list** — separate session in the `gmayers/tooltraq` repo.

## Testing

Jest baseline: 7 known pre-existing failing suites (Button, FormField, PasswordField,
AuthFlow, BillingService, NFCService, NFCUtils) with
`--testPathIgnorePatterns "/node_modules/" "\.worktrees" "/e2e/" "\.e2e\."`.
Each item adds unit tests for its pure logic; no new suite may fail beyond baseline.
Backend: `pytest` for the tool router changes.

## Release

JS-only changes → OTA-eligible on runtime 1.0.0. Bump `CHANGELOG_VERSION` in
`src/constants/changelog.ts` with round-4 entries before publishing. OTA publish
decision (and whether iOS is included this time — it was deliberately excluded on
2026-06-29) rests with the user at the end of the round.
