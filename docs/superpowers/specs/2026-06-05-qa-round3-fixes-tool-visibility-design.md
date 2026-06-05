# QA Round 3 — bug fixes, tool visibility, and a reusable "What's New" popup

**Date:** 2026-06-05
**Status:** Approved (design); pending spec review
**Scope:** `app/wrapbattz` React Native (Expo SDK 54) mobile app only. The web portal and
backend API are separate codebases; items that require server changes are called out as
**[BACKEND]** and only the client side is built here, against the contracts defined below.

---

## 1. Background

A field QA pass (three site/office/admin personas on Android) produced ~25 findings spanning
dark-mode readability, broken save/redirect flows, assignment/return errors, and several feature
requests. The flagship request: **a tool's holder and location must always be visible at a glance,
before any detail expansion** — today, assigning a tool to a location erases the "who has it"
information.

This spec covers all client-fixable items, defines client contracts for the backend-gap features
(Export, fixed Categories, Request Device — backend will be extended to support them), and adds a
reusable, OTA-safe "What's New" popup that summarizes the release.

### Goals
- Text is legible in light **and** dark/system mode on every screen named in QA.
- Holder + location are visible on tool cards before expanding; "last held by" is recoverable for
  location-held tools.
- Assign/transfer/return surface correct, actionable messages and don't dead-end.
- Profile and Organization edits persist and prefill.
- A reusable changelog modal informs users of changes, surviving OTA updates.

### Non-goals
- Web-portal RBAC ("return = no permission") — **[BACKEND]/web**, out of scope.
- Implementing the backend endpoints themselves (categories store, export, request notifications).
- Redesigning navigation or the NFC engine.

---

## 2. Workstreams

### A. Theme / dark-mode readability

**Problem.** `AddLocations.js`, `DeviceDetailsScreen.js`, `LocationDetailsScreen.js`, the
Create-Location modal (in `LocationsScreen.js`), and the "available devices" list hardcode
light-mode colors (`#333`, `#666`, `#999`, `#555`, `#F5F5F5`) and a fixed
`StatusBar barStyle="dark-content"`. In dark mode the text is near-invisible.

**Fix.** Each screen already has (or will add) `const { colors, isDark } = useTheme();`. Convert the
offending label/value/title/container/input colors from static StyleSheet entries to theme-driven
values. Two acceptable patterns, matching what the file already does:
- Inline override on the element: `style={[styles.detailValue, { color: colors.textPrimary }]}`.
- A `useMemo` "themed styles" factory where the file is heavily styled.

Color mapping (from `src/context/ThemeContext.js`):
| Role | Token |
|------|-------|
| Page background | `colors.background` |
| Card / surface | `colors.card` / `colors.surface` |
| Primary text (values, titles, device name) | `colors.textPrimary` |
| Secondary text (labels, make/model, address) | `colors.textSecondary` |
| Borders / dividers | `colors.border` |
| Input background / text | `colors.surface` / `colors.textPrimary` |

`StatusBar` becomes `barStyle={isDark ? 'light-content' : 'dark-content'}`.

`AddLocations.js` does **not** currently call `useTheme()` — add it.

**Screens in scope:** `AddLocations.js`, `DeviceDetailsScreen.js`, `LocationDetailsScreen.js`,
`LocationsScreen.js` (modal + remaining hardcoded styles). Spot-check sibling screens touched by the
same components.

### B. Tool visibility — "who has it & where" (flagship)

**B1. Holder model in the adapter.** In `src/api/adapters.ts`, the assignment adapter gains a
normalized holder derived from the `AssignmentRead` fields:

```ts
// holder describes the *current* assignment target.
type Holder =
  | { kind: 'user'; name: string }      // assignee_user_id present
  | { kind: 'site'; name: string }      // assignee_site_id present (name = site name)
  | null;                               // unassigned
```

Derivation: prefer `assignee_user_id` → `{ kind:'user', name: assignee_user_email }`; else
`assignee_site_id` → `{ kind:'site', name: assignee_site_name }`; else `null`. Expose on the legacy
assignment shape as `holder` (additive — existing `user_name`/`location_name` fields stay for
back-compat).

**B2. Fix `useMyTools.groupMine` bug.** `src/screens/Tools/hooks/useMyTools.ts` currently sets
`toolType: a.assignee_site_name || undefined`, which displays the site name in the type slot and
hides the user. Replace with the holder model so each card renders a dedicated holder line.

**B3. Card holder line.** On the Tools overview, available-devices list, and assigned-tools cards,
render a holder line **above** the "View details" affordance:
- user-held → `👤 <name>`
- site-held → `📍 <site name>`
- unassigned → `Available`

This uses only data already fetched (no extra calls).

**B4. "Last held by" for location-held tools.** When `holder.kind === 'site'`, the current holder
record has no user, so recover the last user-holder from history:
- **Single-tool surfaces** (`DeviceDetailsScreen`, Quick Action result): one eager
  `getToolHistory(toolId)` call; find the most recent assignment with `assignee_user_id`; show
  `last held by <name>`.
- **List surfaces:** lazy + concurrency-capped + cached enrichment for the **visible** site-held
  cards only. A small helper (`enrichLastHeld`) runs ≤4 concurrent `getToolHistory` calls, memoizes
  by `toolId` for the session, and updates the card subtitle when resolved. This avoids an N+1 storm
  while still surfacing the info on the overview. If history fails, the card silently keeps just the
  location (no error toast).

**B5. "Who has it?" quick action.** New action on the worker dashboard quick actions and reachable
from the scan flow: scan a tag → `getToolByNfc(tagUID)` → `getToolHistory` → a compact result card
showing **holder + location + last-held** immediately, with "View full details" beneath. Reuses the
Quick Action modal infrastructure.

### C. Assign / transfer / return correctness

**C1. Return "internal server error".** The print-tags → "My assignments" return path is distinct
from the Quick Action return path. Pin down where it calls `returnAssignment` and confirm the
payload matches `AssignmentReturn` (`{ target_site_id?, condition, notes }`). Hypothesis: it passes
the wrong id (tool id vs assignment id) or omits required fields, yielding a 500. Fix to pass the
active assignment id and a valid payload; verify against the API.

**C2. "Tool already has an active assignment".** Where the UI already knows a tool is assigned
(holder ≠ null), show **Return / Transfer** instead of **Assign**, so the user isn't routed into a
guaranteed-fail Assign. Where the state isn't known ahead of time, keep the action but surface the
backend's message verbatim (already done via `ApiError.message`) — no generic "network error" for a
real 4xx.

**C3. Network-vs-real-error clarity.** Verify assign/transfer failures map to the correct
`ApiError.code`; a 4xx conflict must not render as "Network error — check your connection."

**C4. Return availability.** Return stays available on mobile; RBAC remains server-enforced. The
web-portal permission bug is **[BACKEND]/web** — noted, not fixed here.

### D. Add-device flow

**D1. Fixed categories.** Replace the tool-derived options in `AddDeviceScreen.js` /
`listToolCategories` with a fixed list:

```
Tool · Equipment · Gear · Vehicle/Plant · Materials
```

**[BACKEND] contract.** Until/unless the backend adds a categories store, the client sends the
selected category as follows, in priority order:
1. If a backend category with a matching (case-insensitive) name exists in the derived set, send its
   `category_id`.
2. Else send the category **name** in a `category` field on `ToolCreate` (backend to accept and
   resolve/create). 
3. If the backend rejects an unknown `category` field, fall back to `category_id: null` so create
   still succeeds (category simply unset).

Define the fixed list in a shared constant `src/constants/deviceCategories.ts` so the picker and any
validation share one source of truth.

**D2. Stuck spinner / no redirect.** After a successful create (`AddDeviceScreen.js` submit), the
NFC modal must not strand the user. Behavior:
- On create success, store `createdDeviceId`, reset `loading`.
- If an NFC tag was scanned, keep the write step but make the post-write **and** the
  "skip / done" paths both call a single `finish()` that dismisses the modal and
  `navigation.replace('DeviceDetails', { deviceId })`.
- If no tag flow, auto-advance to `DeviceDetails` (or back to AllDevices) immediately after the
  success acknowledgement — no hidden button.

### E. Profile + Organization

**E1. Profile save persistence.** `EditProfileScreen.js` → `updateUser` → `account.updateMe` →
`applyUser`. The payload field names are correct. Investigate: (a) does `updateMe` return the full
`UserMe` (so `applyUser` has first/last name)? (b) is the response shape what `applyUser` expects?
(c) is an error being swallowed? Fix the actual cause and verify the screen + context reflect the
saved name after save (re-open Edit Profile shows new values). Add a regression unit test around
`applyUser` mapping if the bug is in mapping.

**E2. Organization details prefill.** `CreateOrganizationScreen.js` is create-only. Add an
edit-aware load: when reached from Settings (not onboarding), call
`organizationsApi.getMyOrganization()` in a `useEffect`, prefill fields, switch the title/CTA to
"Save"/edit mode, and submit via the existing `organizationsApi.updateMyOrganization()`
(`PATCH /organizations/me/`) instead of `createOrganization`. Distinguish the two entry modes via a
route param (e.g. `mode: 'edit'`) or by detecting an existing org.

### F. Locations

**F1. `AddLocations.js` create failure.** Remove the undefined `userData` reference (destructure
what's needed from `useAuth()` or drop the gate), uppercase the postcode before send
(`postcode.trim().toUpperCase()`), and theme-ify (workstream A). This is the path that throws the
spurious "network error".

**F2. Postcode normalization.** In `CommonUtils.js`, keep the case-insensitive regex but normalize
input to uppercase + collapse spacing before validation and before send, app-wide, so lowercase
entry is accepted. The backend only accepts uppercase — normalization happens client-side.

**F3. Street number.** Leave alphanumeric allowed (UK addresses legitimately include `12A`, `Flat 2`),
but document the decision in code. No hard numeric restriction (matches QA's "minor quirk").

**F4. Locations list load.** Confirm the single `listSites()` fetch (no N+1). Render with
`FlatList` for virtualization if the current `ScrollView + map` is the slowness source.

### G. Backend-gap features (client built to contract)

User confirmed the backend will be extended. Build the client fully; degrade gracefully (clean
disabled / "coming soon" state) only if the endpoint returns 404.

**G1. Export → CSV + native share.**
- Add deps: `expo-file-system`, `expo-sharing` (currently **MISSING** from package.json; AsyncStorage
  is present).
- New `src/utils/exportCsv.ts`: takes rows + columns → CSV string → writes to a cache file →
  `Sharing.shareAsync(uri)`.
- Wire the dashboard **Export** quick action (currently navigates to AllReports as a placeholder)
  and/or an explicit "Export CSV" button on AllReports to export the currently-loaded/filtered
  reports. Fully client-side; no backend needed.

**G2. Request Device.** **[BACKEND]** contract:
```
POST /tools/{tool_id}/request/      // or /assignments/request/
body: { message?: string }
200/201 → { id, status: 'pending' }
```
Add the **"Request Device"** button on tool detail / available-devices when the tool is held by
someone else. Client calls the endpoint, shows optimistic "Request sent" confirmation, handles 404
by showing "coming soon". Endpoint wrapper lives in `src/api/endpoints/tools.ts`
(`requestTool(toolId, body)`).

**G3. Categories store.** See D1 — the `category` name contract is the **[BACKEND]** ask.

### H. Reusable "What's New" popup (OTA-safe)

**Why OTA-safe matters.** OTA updates ship new JS without bumping the native app version. Keying the
popup off the native version would miss OTA releases. Therefore the trigger is a **changelog version
constant in the JS bundle**.

**Components.**
- `src/constants/changelog.ts`:
  ```ts
  export const CHANGELOG_VERSION = '1.4.0';   // bump every release, incl. OTA-only
  export interface ChangelogEntry { version: string; date: string; highlights: string[]; }
  export const CHANGELOG: ChangelogEntry[]; // newest first
  ```
- `src/components/WhatsNewModal.tsx`: reusable modal rendering the latest entry (or a stack of
  unseen entries). Themed. Reusable for every future release.
- `src/hooks/useWhatsNew.ts`: on mount, read `whatsnew:lastSeenVersion` from AsyncStorage; if
  `CHANGELOG_VERSION` is newer (string compare via semver-ish split, no new dep), show the modal;
  on dismiss, write `CHANGELOG_VERSION`.
- Mount the hook/modal near the app root (after auth, inside the themed tree).
- Add a **"What's New"** row in Settings that opens the same modal on demand (ignores the
  seen-state).

**This release's entry** summarizes: readability fixes, who-has-it/where visibility, assign/return
fixes, profile/org save, location fixes, export, and the renamed Browse Devices action.

### I. Misc

- Rename quick action **"Print tags" → "Browse Devices"** (`FleetStatusScreen.tsx` quickActions).
- Confirm **"My Tools"** button navigation works (exploration says fixed) — verify, no change if OK.
- **NFC cleanup:** call `NfcManager.cancelTechnologyRequest()` on Quick Action modal unmount to stop
  the back-button → home + "NFC read failed, operation was cancelled" sequence.
- **NFC "Upgrade":** it re-writes the tag (`writeDeviceToNFC`). Add a timeout with user feedback so
  it can't hang forever; relabel for clarity (e.g. "Re-write tag data") with a one-line explanation.
- **Donut "0 / 17":** reconcile `useFleetStatusData` totals so `total ≥ inUse` always holds even when
  `listTools` returns empty under flakiness, and ensure `InventoryDonutCard` renders the reconciled
  `total`. Add a unit test.
- **Tools "no tools yet" flicker:** in `useMyTools`, don't clear `groups` to empty on a transient
  error or mid-flight focus refresh; keep last-good data and only show empty on a confirmed empty
  response.
- **Incident photos:** verify display path (`ReportDetailsScreen` already resolves relative URLs) —
  fix only if a gap is found.

---

## 3. Data flow (flagship, condensed)

```
ToolsScreen / AvailableDevices / AssignedTools
  └─ useMyTools / list hooks → AssignmentRead[] / ToolRead[]
       └─ adapters.toLegacyAssignment → { ...legacy, holder }
            ├─ card renders holder line (👤 name | 📍 site | Available)   [no extra call]
            └─ if holder.kind==='site' on a visible card:
                 enrichLastHeld(toolId)  [≤4 concurrent, cached]
                   └─ getToolHistory → most-recent user assignment → "last held by X"

Scan "Who has it?" → getToolByNfc → { holder, site } + getToolHistory → result card
```

---

## 4. Backend contracts summary (for the backend team)

| Feature | Method / path | Request | Response | Fallback if absent |
|---------|---------------|---------|----------|--------------------|
| Categories | `POST /tools/` (existing) | add `category: string` (name) to `ToolCreate` | resolves/creates category | send `category_id` if name matches derived set; else `null` |
| Request device | `POST /tools/{id}/request/` | `{ message?: string }` | `{ id, status:'pending' }` | 404 → "coming soon" UI |
| Org update | `PATCH /organizations/me/` (exists: `updateMyOrganization`) | `OrganizationUpdate` | `OrganizationRead` | n/a — already available |
| Export | none — fully client-side CSV | — | — | — |

---

## 5. Testing

**Unit (Jest):**
- `adapters` holder derivation: user-held, site-held, unassigned.
- postcode normalization (lowercase → accepted, spacing).
- changelog version comparison (newer/older/equal → show/skip).
- `exportCsv` string generation (escaping commas/quotes/newlines).
- donut total reconciliation (`total ≥ inUse`).

**Manual / device (NFC needs hardware):**
- Dark mode legibility on each touched screen.
- Profile save → re-open shows saved name.
- Org details prefilled.
- Add device → redirects to detail, no stuck spinner.
- Create location (both paths) succeeds with lowercase postcode.
- Assign/Return/Transfer happy + conflict paths show correct messages.
- "Who has it?" scan shows holder + location + last-held.
- What's New shows once after a version bump, re-openable from Settings, persists dismissal.

Baseline note: the repo has ~7 pre-existing test failures and `.worktrees` pollution
(see memory `project_release_ota_setup`); judge new tests against that baseline.

---

## 6. Delivery / version control

- One feature branch off `master` (e.g. `qa-round3-fixes`).
- Logical commits per workstream (theme, visibility, assign/return, add-device, profile/org,
  locations, export, whats-new, misc).
- Bump app version (`package.json` and the changelog constant; align `app.json`/`runtimeVersion`
  per the OTA setup).
- PR summarizing the QA findings addressed, with the **[BACKEND]** contract table for the backend team.
