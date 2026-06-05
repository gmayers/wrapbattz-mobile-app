# QA Round 3 Fixes + Tool Visibility + What's New — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the QA-round-3 findings (dark-mode readability, save/redirect/assignment bugs), make a tool's holder + location always visible (incl. "last held by" from history), and add a reusable OTA-safe "What's New" popup.

**Architecture:** Pure-logic changes (adapter holder model, postcode normalization, changelog compare, CSV, donut reconciliation) are TDD'd with Jest. UI/theme changes are concrete edits verified manually (and on-device for NFC). Backend-gap features (Export, Request Device, fixed Categories) are built client-side against the contracts in the spec.

**Tech Stack:** React Native 0.81 / Expo SDK 54, TypeScript+JS mixed, React Navigation v7, Axios (`src/api`), `ThemeContext` (useTheme), AsyncStorage, Jest (`@/` → `src/`).

**Spec:** `docs/superpowers/specs/2026-06-05-qa-round3-fixes-tool-visibility-design.md`

**Branch:** `qa-round3-fixes` (already created; spec committed).

**Conventions:**
- Run a single test file: `npm test -- src/tests/unit/<file>.test.ts`
- Baseline has ~7 pre-existing failures + `.worktrees` pollution — judge only your new/edited tests.
- Commit after each task. Commit message footer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure (what gets created / modified)

**Created:**
- `src/constants/deviceCategories.ts` — fixed category list + name↔id matcher.
- `src/constants/changelog.ts` — `CHANGELOG_VERSION` + entries.
- `src/components/WhatsNewModal.tsx` — reusable changelog modal.
- `src/hooks/useWhatsNew.ts` — seen-state + auto-show logic.
- `src/utils/exportCsv.ts` — rows→CSV→share.
- `src/tests/unit/holder.test.ts`, `postcodeNormalize.test.ts`, `changelogVersion.test.ts`, `exportCsv.test.ts`, `donutTotals.test.ts`.

**Modified (key):**
- `src/api/adapters.ts` — `holder` on legacy assignment + helper.
- `src/api/endpoints/tools.ts` — `requestTool()`.
- `src/screens/Tools/hooks/useMyTools.ts` — holder line, last-held enrichment, no-flicker.
- `src/screens/Dashboard/FleetStatus/hooks/useFleetStatusData.ts` + `components/InventoryDonutCard.tsx` — donut totals.
- `src/screens/Dashboard/FleetStatus/FleetStatusScreen.tsx` — rename "Print tags"→"Browse Devices", Export wiring, "Who has it?".
- `src/screens/EditProfileScreen.js`, `src/auth/AuthContext.tsx` — profile save.
- `src/screens/CreateOrganizationScreen.js` — org prefill/edit.
- `src/screens/AddDeviceScreen.js` — fixed categories + redirect.
- `src/screens/AddLocations.js`, `src/screens/LocationsScreen.js`, `src/utils/CommonUtils.js` — locations fixes + postcode.
- `src/screens/DeviceDetailsScreen.js`, `src/screens/LocationDetailsScreen.js` — theme + holder/last-held.
- `src/screens/QuickAction/QuickActionModalScreen.tsx` — return fix, NFC cleanup, upgrade timeout, holder display.
- Settings sections + app root — What's New entry + mount.
- `package.json` / `app.json` — deps + version bump.

---

## Task 1: Holder model in the adapter (TDD)

**Files:**
- Modify: `src/api/adapters.ts`
- Test: `src/tests/unit/holder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/unit/holder.test.ts
import { toLegacyAssignment } from '@/api/adapters';

const base = {
  id: 1, uuid: 'u', tool_id: 9, tool_name: 'Drill',
  assigned_at: null, returned_at: null, status: 'active', condition: '', notes: '',
  assignee_user_id: null, assignee_user_email: '',
  assignee_site_id: null, assignee_site_name: '',
} as any;

describe('toLegacyAssignment holder', () => {
  it('user-held → holder.kind user', () => {
    const a = toLegacyAssignment({ ...base, assignee_user_id: 5, assignee_user_email: 'wendy@x.com' });
    expect(a.holder).toEqual({ kind: 'user', name: 'wendy@x.com' });
  });
  it('site-held → holder.kind site', () => {
    const a = toLegacyAssignment({ ...base, assignee_site_id: 3, assignee_site_name: 'Depot A' });
    expect(a.holder).toEqual({ kind: 'site', name: 'Depot A' });
  });
  it('user takes precedence over site when both present', () => {
    const a = toLegacyAssignment({ ...base, assignee_user_id: 5, assignee_user_email: 'w@x.com', assignee_site_id: 3, assignee_site_name: 'Depot A' });
    expect(a.holder).toEqual({ kind: 'user', name: 'w@x.com' });
  });
  it('unassigned → holder null', () => {
    expect(toLegacyAssignment(base).holder).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- src/tests/unit/holder.test.ts`
Expected: FAIL (`holder` undefined).

- [ ] **Step 3: Implement**

In `src/api/adapters.ts`, add the type and a helper above `toLegacyAssignment`, and add `holder` to the `LegacyAssignment` interface and the returned object:

```ts
export type Holder =
  | { kind: 'user'; name: string }
  | { kind: 'site'; name: string }
  | null;

export function deriveHolder(a: AssignmentRead): Holder {
  if (a.assignee_user_id != null) return { kind: 'user', name: a.assignee_user_email ?? '' };
  if (a.assignee_site_id != null) return { kind: 'site', name: a.assignee_site_name ?? '' };
  return null;
}
```

Add `holder: Holder;` to the `LegacyAssignment` interface, and in the returned object add:
`holder: deriveHolder(a),`

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- src/tests/unit/holder.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/adapters.ts src/tests/unit/holder.test.ts
git commit -m "feat(adapters): add normalized holder (user|site) to legacy assignment"
```

---

## Task 2: Tools overview — holder line + fix groupMine + no-flicker

**Files:**
- Modify: `src/screens/Tools/hooks/useMyTools.ts`
- Modify: the tools list-item component rendering `toolType` (find via `ToolItem` usage in `src/screens/Tools/`).

- [ ] **Step 1: Fix `groupMine` to carry holder, not overwrite type**

Replace the `groupMine` map (currently `toolType: a.assignee_site_name || undefined`) so the holder is explicit. Add `holderLabel` to the `ToolItem` shape (extend its type where defined) and set:

```ts
const tools: ToolItem[] = assignments.map((a) => {
  const holder = a.assignee_user_id != null
    ? `👤 ${a.assignee_user_email || 'Assigned'}`
    : a.assignee_site_id != null
      ? `📍 ${a.assignee_site_name || 'Location'}`
      : 'Available';
  return {
    id: String(a.tool_id),
    identifier: a.tool_name,
    toolType: undefined,
    holderLabel: holder,
    siteHeld: a.assignee_user_id == null && a.assignee_site_id != null,
    status: 'assigned',
  };
});
```

In `groupAll`, set `holderLabel` from the tool's current assignment if present on `ToolRead` (`t.current_assignment`); otherwise leave `holderLabel: 'Available'` and keep `toolType` as today for the type subtitle.

- [ ] **Step 2: Render the holder line in the list item**

In the tools list-item component, render `holderLabel` as a distinct line above the "View details" affordance, styled `{ color: colors.textPrimary, fontWeight: '600' }`. Keep `toolType` as a secondary line (`colors.textSecondary`).

- [ ] **Step 3: No-flicker on transient error / focus refresh**

In `useMyTools`, in the `catch` and the focus-refresh path, do **not** call `setGroups([])`. Only set empty groups when the API returns a confirmed empty list. On error, keep previous `groups` and set `error`. Guard: keep a `hasLoadedOnce` ref; show the empty state only when `hasLoadedOnce && groups.length === 0 && !isLoading && !error`.

- [ ] **Step 4: Verify (manual)**

Run app (`npm run android`), open Tools as a worker: each assigned tool shows `👤`/`📍` holder line; navigating away/back doesn't flash "No tools yet".

- [ ] **Step 5: Commit**

```bash
git add src/screens/Tools/
git commit -m "fix(tools): show holder line; stop person being hidden by location; no empty-flicker"
```

---

## Task 3: Last-held-by enrichment for location-held tools (TDD helper + wiring)

**Files:**
- Create: `src/screens/Tools/hooks/lastHeld.ts`
- Test: `src/tests/unit/lastHeld.test.ts`
- Modify: `src/screens/Tools/hooks/useMyTools.ts`

- [ ] **Step 1: Write failing test for the pure picker**

```ts
// src/tests/unit/lastHeld.test.ts
import { pickLastUserHolder } from '@/screens/Tools/hooks/lastHeld';

it('returns most recent assignment that had a user', () => {
  const history = [
    { assigned_at: '2026-01-01', assignee_user_id: null, assignee_user_email: '', assignee_site_id: 2, assignee_site_name: 'Depot' },
    { assigned_at: '2026-02-01', assignee_user_id: 7, assignee_user_email: 'sylvia@x.com', assignee_site_id: null, assignee_site_name: '' },
    { assigned_at: '2026-03-01', assignee_user_id: null, assignee_user_email: '', assignee_site_id: 2, assignee_site_name: 'Depot' },
  ] as any[];
  expect(pickLastUserHolder(history)).toBe('sylvia@x.com');
});
it('returns null when no user ever held it', () => {
  expect(pickLastUserHolder([{ assigned_at: '2026-01-01', assignee_user_id: null }] as any)).toBeNull();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- src/tests/unit/lastHeld.test.ts` → FAIL.

- [ ] **Step 3: Implement `lastHeld.ts`**

```ts
import type { AssignmentRead } from '@/api/types';

export function pickLastUserHolder(history: AssignmentRead[]): string | null {
  const withUser = history
    .filter((h) => h.assignee_user_id != null)
    .sort((a, b) => String(b.assigned_at ?? '').localeCompare(String(a.assigned_at ?? '')));
  return withUser.length ? (withUser[0].assignee_user_email || null) : null;
}

// Concurrency-capped, session-cached enrichment.
const cache = new Map<number, string | null>();
export async function enrichLastHeld(
  toolIds: number[],
  getHistory: (id: number) => Promise<{ items: AssignmentRead[] }>,
  onResolved: (toolId: number, lastHeld: string | null) => void,
  limit = 4,
): Promise<void> {
  const queue = toolIds.filter((id) => !cache.has(id));
  let i = 0;
  async function worker() {
    while (i < queue.length) {
      const id = queue[i++];
      try {
        const page = await getHistory(id);
        const name = pickLastUserHolder(page.items ?? []);
        cache.set(id, name);
        onResolved(id, name);
      } catch {
        cache.set(id, null);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
  // Re-emit cached hits immediately.
  for (const id of toolIds) if (cache.has(id)) onResolved(id, cache.get(id) ?? null);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- src/tests/unit/lastHeld.test.ts` → PASS.

- [ ] **Step 5: Wire into `useMyTools`**

After groups are set, collect `toolId`s of visible site-held items (`siteHeld === true`), call `enrichLastHeld(ids, (id) => toolsApi.getToolHistory(Number(id)), (id, name) => { /* setGroups updater appending "· last held by <name>" to that item's holderLabel when name */ })`. Update the item's `holderLabel` to `📍 <site> · last held by <name>` when `name` resolves.

- [ ] **Step 6: Verify (manual)** — a location-held tool shows "last held by …" shortly after the list loads.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Tools/hooks/lastHeld.ts src/tests/unit/lastHeld.test.ts src/screens/Tools/hooks/useMyTools.ts
git commit -m "feat(tools): recover 'last held by' for location-held tools via history (lazy, capped, cached)"
```

---

## Task 4: "Who has it?" quick action + holder display in Quick Action

**Files:**
- Modify: `src/screens/QuickAction/QuickActionModalScreen.tsx`
- Modify: `src/screens/Dashboard/quickActions.ts` (worker actions)
- Modify: `src/screens/Dashboard/DashboardScreen.tsx` if a new destination/scan trigger is needed.

- [ ] **Step 1: Holder + last-held block in Quick Action result**

In `QuickActionModalScreen`, after `device` loads, compute holder from `device.current_assignment` / `device.holder` and, when site-held, call `toolsApi.getToolHistory(device.id)` once and `pickLastUserHolder`. Render a prominent block at the top of the found-device card: `👤 <name>` or `📍 <site> · last held by <name>`, before "View full details".

- [ ] **Step 2: Add "Who has it?" worker quick action**

In `src/screens/Dashboard/quickActions.ts`, add `{ key: 'whoHasIt', label: 'Who has it?', icon: 'search-outline', action: 'scan' }` that triggers the existing scan flow (reuse `useScanTag` → navigates to `QuickActionModal`). The Quick Action result (Step 1) now shows holder+location immediately.

- [ ] **Step 3: Verify (device, NFC)** — scan a location-held tool → see holder + location + last-held without expanding.

- [ ] **Step 4: Commit**

```bash
git add src/screens/QuickAction/ src/screens/Dashboard/
git commit -m "feat(scan): 'Who has it?' shows holder + location + last-held up front"
```

---

## Task 5: Return "internal server error" fix

**Files:**
- Modify: the print-tags / "My assignments" return path (locate the screen behind the FleetStatus "Browse Devices" / AllDevices "Return" button and the My-assignments list `Return` handler).
- Reference: `src/api/endpoints/assignments.ts` (`returnAssignment(assignmentId, { target_site_id?, condition, notes })`).

- [ ] **Step 1: Locate the failing handler**

Run: `grep -rn "returnAssignment\|handleReturn\|Return" src/screens/AllDevices* src/screens/Tools* src/screens/*Assignments* 2>/dev/null`
Identify the handler that fires the 500.

- [ ] **Step 2: Fix the payload/id**

Ensure it passes the **assignment id** (not tool id) and a valid `AssignmentReturn` body. If the device only knows the tool, resolve the active assignment id from `device.current_assignment.id`. Match the working QuickAction call:

```ts
await assignmentsApi.returnAssignment(Number(assignmentId), { condition: '', notes: '' });
```

(omit `target_site_id` when returning to stock; include it only when a destination is chosen.)

- [ ] **Step 3: Verify (device)** — return a newly-assigned tool → success, no 500. If the 500 persists with a correct payload, capture the response body and flag as **[BACKEND]** in the PR.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(assignments): correct return payload/id to stop 500 on return"
```

---

## Task 6: Assign/transfer — gate when already held + correct error surfacing

**Files:**
- Modify: `src/screens/DeviceDetailsScreen.js`, `src/screens/LocationDetailsScreen.js`, `src/screens/QuickAction/QuickActionModalScreen.tsx`.

- [ ] **Step 1: Gate the Assign action**

Where the screen knows `holder !== null` (tool already assigned), render **Return** / **Transfer** instead of **Assign to me**, so the user can't trigger the guaranteed "already has an active assignment" failure. When holder is unknown, keep Assign.

- [ ] **Step 2: Correct error copy**

Confirm assign/transfer catch blocks show `error.message` from `ApiError` for 4xx (so "Tool already has an active assignment" shows verbatim) and only show "Network error — check your connection" for `code === 'network'`. Fix any branch that defaults a 4xx to the network message.

- [ ] **Step 3: Verify (device)** — assigned tool shows Return/Transfer, not Assign; a real conflict shows the backend message; offline shows network message.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(assign): gate assign when tool already held; surface real vs network errors"
```

---

## Task 7: Postcode normalization (TDD) + locations create fixes

**Files:**
- Modify: `src/utils/CommonUtils.js`
- Modify: `src/screens/AddLocations.js`, `src/screens/LocationsScreen.js`
- Test: `src/tests/unit/postcodeNormalize.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/tests/unit/postcodeNormalize.test.ts
const { normalizePostcode } = require('@/utils/CommonUtils');

it('uppercases and trims', () => {
  expect(normalizePostcode(' sw1a 1aa ')).toBe('SW1A 1AA');
});
it('passes through valid uppercase', () => {
  expect(normalizePostcode('EC1A 1BB')).toBe('EC1A 1BB');
});
```

- [ ] **Step 2: Run, verify fail** → `npm test -- src/tests/unit/postcodeNormalize.test.ts`

- [ ] **Step 3: Implement** — in `CommonUtils.js` export:

```js
const normalizePostcode = (pc) => (pc || '').toString().trim().toUpperCase().replace(/\s+/g, ' ');
```

Add `normalizePostcode` to module exports.

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Fix `AddLocations.js`**

Remove the undefined `userData` reference (line ~278 — destructure from `useAuth()` what is actually needed, or remove the gate). Normalize postcode before send: `postcode: normalizePostcode(formData.postcode)`. Validate with `validate.ukPostcode(normalizePostcode(...))`.

- [ ] **Step 6: Apply normalization in `LocationsScreen.js` modal too** (it already `.toUpperCase()`s — switch to `normalizePostcode` for consistency).

- [ ] **Step 7: Verify (device)** — create a location with a lowercase postcode via both the "Add first location" and "Create Location" paths → succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/utils/CommonUtils.js src/screens/AddLocations.js src/screens/LocationsScreen.js src/tests/unit/postcodeNormalize.test.ts
git commit -m "fix(locations): normalize postcode case; fix AddLocations crash and create"
```

---

## Task 8: Dark-mode readability sweep

**Files:**
- Modify: `src/screens/AddLocations.js`, `src/screens/DeviceDetailsScreen.js`, `src/screens/LocationDetailsScreen.js`, `src/screens/LocationsScreen.js`.

- [ ] **Step 1: `AddLocations.js`** — add `const { colors, isDark } = useTheme();`. Replace hardcoded `#FFFFFF`/`#333`/`#FAFAFA`/`#999` on container/label/input with theme tokens (container→`colors.background`, label→`colors.textSecondary`, input bg→`colors.surface`, input text→`colors.textPrimary`, border→`colors.border`). `StatusBar barStyle={isDark ? 'light-content' : 'dark-content'}`.

- [ ] **Step 2: `DeviceDetailsScreen.js`** — it already calls `useTheme()`. Override the hardcoded style colors at usage sites: `sectionTitle`/`detailValue`/`historyDate`→`colors.textPrimary`; `detailLabel`→`colors.textSecondary`; `container`→`colors.background`; cards→`colors.card`.

- [ ] **Step 3: `LocationDetailsScreen.js`** — same treatment: `sectionTitle`/`detailValue`→`colors.textPrimary`; `addressText`/`detailLabel`→`colors.textSecondary`; `container`→`colors.background`. Ensure the "Available devices" title and device name/make/model use theme colors.

- [ ] **Step 4: `LocationsScreen.js`** — replace remaining hardcoded `#333`/`#666` style colors with theme overrides; fix the hardcoded `StatusBar barStyle="dark-content"`.

- [ ] **Step 5: Verify (device, both modes)** — toggle system dark mode; confirm labels, values, titles, inputs, device name/make/model are legible on all four screens.

- [ ] **Step 6: Commit**

```bash
git add src/screens/AddLocations.js src/screens/DeviceDetailsScreen.js src/screens/LocationDetailsScreen.js src/screens/LocationsScreen.js
git commit -m "fix(theme): make Locations/DeviceDetails text legible in dark/system mode"
```

---

## Task 9: Profile save persistence

**Files:**
- Modify: `src/screens/EditProfileScreen.js` and/or `src/auth/AuthContext.tsx` / `src/api/endpoints/account.ts`.

- [ ] **Step 1: Reproduce + locate cause**

Add a temporary log in `updateUser` (AuthContext) of the `me` returned by `account.updateMe`. Run app, save first/last name, observe: does `updateMe` return the updated fields? Does `applyUser(me)` run? Is an error thrown/swallowed in `EditProfileScreen.handleSubmit`?

- [ ] **Step 2: Fix the actual cause**

Likely candidates and fixes:
- If `updateMe` returns a partial body lacking name fields → re-fetch via `account.getMe()`/bootstrap after patch and `applyUser` that, or merge returned fields into current user.
- If `EditProfileScreen` doesn't `await`/navigate or swallows the error → await, show success, pop screen.
Implement the specific fix found.

- [ ] **Step 3: Add a regression unit test if the bug was in mapping**

If `applyUser`/merge logic was wrong, add `src/tests/unit/applyUser.test.ts` asserting the merged user contains the new `first_name`/`last_name`.

- [ ] **Step 4: Remove temp logs. Verify (device)** — edit name, save, re-open Edit Profile → new values shown; profile header updated.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(profile): persist first/last name edits to auth context"
```

---

## Task 10: Organization details prefill / edit mode

**Files:**
- Modify: `src/screens/CreateOrganizationScreen.js`
- Reference: `src/api/endpoints/organizations.ts` (`getMyOrganization`, `updateMyOrganization`).
- Check: the Settings nav entry that routes here (`src/screens/Settings/sections.ts`) — pass `mode: 'edit'`.

- [ ] **Step 1: Add edit detection + load**

Add `import { useEffect } from 'react'`. Read `route.params?.mode`. On mount, if `mode === 'edit'` (or always try, ignoring 404), call `organizationsApi.getMyOrganization()` and prefill `name`, `trading_name`, `email`, `phone`, `website` (map to the actual `OrganizationRead` fields). Guard with a loading flag.

- [ ] **Step 2: Branch submit**

In edit mode, submit via `organizationsApi.updateMyOrganization(payload)` (PATCH) and show "Saved"; in create mode keep `createOrganization`. Update the title/CTA copy accordingly ("Organization details" / "Save").

- [ ] **Step 3: Pass `mode:'edit'` from Settings** — in `sections.ts`, set the org-details nav params to `{ mode: 'edit' }`.

- [ ] **Step 4: Verify (device)** — open Organization details from Settings → fields prefilled; edit + save persists; reopening shows saved data.

- [ ] **Step 5: Commit**

```bash
git add src/screens/CreateOrganizationScreen.js src/screens/Settings/sections.ts
git commit -m "feat(org): prefill + edit organization details from Settings"
```

---

## Task 11: Add-device — fixed categories + redirect fix

**Files:**
- Create: `src/constants/deviceCategories.ts`
- Modify: `src/screens/AddDeviceScreen.js`
- Reference: `src/api/endpoints/tools.ts` (`createTool`, `listToolCategories`).

- [ ] **Step 1: Create the constant**

```ts
// src/constants/deviceCategories.ts
export const DEVICE_CATEGORIES = ['Tool', 'Equipment', 'Gear', 'Vehicle/Plant', 'Materials'] as const;
export type DeviceCategory = typeof DEVICE_CATEGORIES[number];

// Match a fixed label to an existing backend category id (case-insensitive) if present.
export function matchCategoryId(
  label: string,
  backend: { id: number; name: string }[],
): number | null {
  const hit = backend.find((c) => c.name.trim().toLowerCase() === label.trim().toLowerCase());
  return hit ? hit.id : null;
}
```

- [ ] **Step 2: Use fixed options in the picker**

In `AddDeviceScreen.js`, build picker options from `DEVICE_CATEGORIES` (label === value === the name). Still fetch `listToolCategories()` to get backend `{id,name}` for matching, but the **displayed options are the fixed five**. Store the selected category **name** in form state.

- [ ] **Step 3: Send per the contract on create**

```js
const matchedId = matchCategoryId(formData.category, backendCategories);
const created = await toolsApi.createTool({
  name, make, model, serial_number,
  ...(matchedId != null ? { category_id: matchedId } : { category: formData.category }),
  nfc_tag_id: nfcTagId ?? null,
});
```

If the backend 400s on the unknown `category` field, retry once with `category_id: null` (category unset) so creation still succeeds; log a `[BACKEND]` note.

- [ ] **Step 4: Fix the stuck spinner / redirect**

After successful create: store `createdDeviceId`, set `loading=false`. Make both the post-NFC-write path and the "skip/done" path call one `finish()`:

```js
const finish = () => {
  setNfcModalVisible(false);
  if (createdDeviceId) navigation.replace('DeviceDetails', { deviceId: createdDeviceId });
  else navigation.goBack();
};
```

If there is no NFC write step pending, call `finish()` right after the success acknowledgement instead of leaving a button the user must find.

- [ ] **Step 5: Verify (device)** — create a device (with and without scanning a tag) → lands on DeviceDetails, no stuck spinner; category shows the five options.

- [ ] **Step 6: Commit**

```bash
git add src/constants/deviceCategories.ts src/screens/AddDeviceScreen.js
git commit -m "fix(add-device): fixed category list + auto-redirect after create"
```

---

## Task 12: Donut totals (TDD) + tools-count reconciliation

**Files:**
- Create: `src/screens/Dashboard/FleetStatus/hooks/donutTotals.ts` (extract the pure calc)
- Modify: `src/screens/Dashboard/FleetStatus/hooks/useFleetStatusData.ts`, `components/InventoryDonutCard.tsx`
- Test: `src/tests/unit/donutTotals.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/tests/unit/donutTotals.test.ts
import { computeInventory } from '@/screens/Dashboard/FleetStatus/hooks/donutTotals';

it('total is never less than in-use even when tool list is empty', () => {
  const r = computeInventory({ toolCount: null, toolsTotal: 0, inUse: 17, maintenance: 0, missing: 0 });
  expect(r.total).toBe(17);
  expect(r.available).toBe(0);
  expect(r.inUse).toBe(17);
});
it('uses the largest known total', () => {
  const r = computeInventory({ toolCount: 20, toolsTotal: 19, inUse: 17, maintenance: 1, missing: 0 });
  expect(r.total).toBe(20);
  expect(r.available).toBe(2);
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `donutTotals.ts`**

```ts
export interface InventoryInput {
  toolCount: number | null; toolsTotal: number; inUse: number; maintenance: number; missing: number;
}
export interface Inventory { total: number; inUse: number; maintenance: number; missing: number; available: number; }

export function computeInventory(i: InventoryInput): Inventory {
  const total = Math.max(i.toolCount ?? 0, i.toolsTotal, i.inUse);
  const available = Math.max(0, total - i.inUse - i.maintenance - i.missing);
  return { total, inUse: i.inUse, maintenance: i.maintenance, missing: i.missing, available };
}
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Use it** — in `useFleetStatusData.ts` replace the inline calc with `computeInventory(...)`. In `InventoryDonutCard.tsx` confirm the center renders `data.total` (the reconciled value).

- [ ] **Step 6: Verify (device)** — donut center and "in use" agree (no "0 / 17").

- [ ] **Step 7: Commit**

```bash
git add src/screens/Dashboard/FleetStatus/hooks/donutTotals.ts src/tests/unit/donutTotals.test.ts src/screens/Dashboard/FleetStatus/
git commit -m "fix(dashboard): reconcile donut totals so total >= in-use"
```

---

## Task 13: Export → CSV + native share (TDD + deps)

**Files:**
- Modify: `package.json` (add `expo-file-system`, `expo-sharing`)
- Create: `src/utils/exportCsv.ts`
- Test: `src/tests/unit/exportCsv.test.ts`
- Modify: `src/screens/AllReportsScreen.js` (Export button) + `FleetStatusScreen.tsx` Export action.

- [ ] **Step 1: Add deps**

Run: `npx expo install expo-file-system expo-sharing`
Expected: both added to `package.json` dependencies.

- [ ] **Step 2: Write failing test for `toCsv`**

```ts
// src/tests/unit/exportCsv.test.ts
import { toCsv } from '@/utils/exportCsv';

it('builds csv with header and escaping', () => {
  const csv = toCsv(
    [{ name: 'Drill', note: 'has, comma' }, { name: 'Saw "X"', note: 'line\nbreak' }],
    [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note' }],
  );
  expect(csv).toBe('Name,Note\r\nDrill,"has, comma"\r\n"Saw ""X""","line\nbreak"');
});
```

- [ ] **Step 3: Run, verify fail.**

- [ ] **Step 4: Implement `exportCsv.ts`**

```ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface Column { key: string; label: string; }

function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], cols: Column[]): string {
  const header = cols.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(',')).join('\r\n');
  return body ? `${header}\r\n${body}` : header;
}

export async function shareCsv(filename: string, rows: Record<string, unknown>[], cols: Column[]): Promise<void> {
  const csv = toCsv(rows, cols);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
}
```

Note: the test only exercises `toCsv` (pure); `expo-file-system`/`expo-sharing` are mocked in jest if imported — if Jest errors on the import, move `toCsv` into a separate import-light module or add a jest mock. Prefer keeping `toCsv` pure and side-effect-free (it already is).

- [ ] **Step 5: Run, verify pass.**

- [ ] **Step 6: Wire Export UI**

In `AllReportsScreen.js`, add an "Export CSV" button that calls `shareCsv('reports.csv', filteredReports, [...columns])` for the currently filtered reports. Point the dashboard **Export** quick action at AllReports (it already does) and ensure the button is visible there.

- [ ] **Step 7: Verify (device)** — Export opens the native share sheet with a valid CSV of the visible reports.

- [ ] **Step 8: Commit**

```bash
git add package.json src/utils/exportCsv.ts src/tests/unit/exportCsv.test.ts src/screens/AllReportsScreen.js
git commit -m "feat(export): CSV export of reports via native share"
```

---

## Task 14: Request Device button + endpoint wrapper

**Files:**
- Modify: `src/api/endpoints/tools.ts`
- Modify: `src/screens/DeviceDetailsScreen.js` / available-devices view.

- [ ] **Step 1: Add endpoint wrapper**

```ts
// src/api/endpoints/tools.ts
export async function requestTool(toolId: number, body: { message?: string } = {}): Promise<{ id: number; status: string }> {
  const { data } = await apiClient.post(`/tools/${toolId}/request/`, body);
  return data as { id: number; status: string };
}
```

- [ ] **Step 2: Add the button**

On DeviceDetails / available-devices, when the tool is held by someone else (holder.kind === 'user' and not the current user), show **"Request Device"**. On press: optimistic `Alert.alert('Request sent', ...)`, call `toolsApi.requestTool(id, {})`. On `ApiError` with status 404, show "This feature is coming soon."; on other errors show `error.message`.

- [ ] **Step 3: Verify (device)** — button appears for tools held by others; pressing it confirms (or shows "coming soon" until backend ships the route).

- [ ] **Step 4: Commit**

```bash
git add src/api/endpoints/tools.ts src/screens/DeviceDetailsScreen.js
git commit -m "feat(request): Request Device button + endpoint wrapper (backend contract)"
```

---

## Task 15: NFC — Quick Action cleanup + Upgrade timeout/relabel

**Files:**
- Modify: `src/screens/QuickAction/QuickActionModalScreen.tsx`
- Reference: `src/services/NFCService.ts`, `react-native-nfc-manager`.

- [ ] **Step 1: Cancel NFC on unmount**

In `QuickActionModalScreen`, add a cleanup effect:

```tsx
useEffect(() => () => { NfcManager.cancelTechnologyRequest().catch(() => {}); }, []);
```

(import `NfcManager` from `react-native-nfc-manager`). This stops the back-button → home → "NFC read failed, operation was cancelled" sequence by tearing down any pending read.

- [ ] **Step 2: Timeout the "Upgrade"/re-write**

Wrap `handleUpgradeTag`'s `writeDeviceToNFC` in a timeout so the spinner can't hang forever:

```tsx
const result = await Promise.race([
  nfcService.writeDeviceToNFC(payload, { includeUniversalLink: true }),
  new Promise((_, rej) => setTimeout(() => rej(new Error('NFC timed out — hold the tag steady and try again.')), 20000)),
]);
```

Ensure `setUpgrading(false)` runs in `finally`. Relabel the button to **"Re-write tag data"** with a one-line helper text explaining it refreshes the data stored on the tag.

- [ ] **Step 3: Verify (device)** — backing out of Quick Action returns cleanly with no cancellation alert; "Re-write tag data" either completes or times out with a clear message.

- [ ] **Step 4: Commit**

```bash
git add src/screens/QuickAction/QuickActionModalScreen.tsx
git commit -m "fix(nfc): cancel pending read on unmount; timeout + relabel tag re-write"
```

---

## Task 16: Misc — rename Browse Devices, verify My Tools & incident photos

**Files:**
- Modify: `src/screens/Dashboard/FleetStatus/FleetStatusScreen.tsx`.

- [ ] **Step 1: Rename quick action** — change the `printTags` action `label: 'Print tags'` → `label: 'Browse Devices'` (keep its `AllDevices` destination); update the `key` to `browseDevices` and icon if desired.

- [ ] **Step 2: Verify My Tools** — confirm the worker "My Tools" quick action navigates to the Tools tab (exploration says wired). No change if OK.

- [ ] **Step 3: Verify incident photos** — create an incident with a photo, open it in ReportDetails, confirm the photo displays (URL resolution already handles relative paths). Fix only if a gap appears.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Dashboard/FleetStatus/FleetStatusScreen.tsx
git commit -m "chore(dashboard): rename 'Print tags' to 'Browse Devices'"
```

---

## Task 17: What's New popup (TDD compare) + components + Settings entry

**Files:**
- Create: `src/constants/changelog.ts`, `src/components/WhatsNewModal.tsx`, `src/hooks/useWhatsNew.ts`
- Test: `src/tests/unit/changelogVersion.test.ts`
- Modify: app root (where the themed tree mounts after auth — e.g. `src/navigation/index.tsx` or `App` root) + `src/screens/Settings/sections.ts`.

- [ ] **Step 1: Write failing test for version compare**

```ts
// src/tests/unit/changelogVersion.test.ts
import { isNewer } from '@/hooks/useWhatsNew';

it('detects newer versions', () => {
  expect(isNewer('1.4.0', '1.3.0')).toBe(true);
  expect(isNewer('1.4.1', '1.4.0')).toBe(true);
  expect(isNewer('1.4.0', '1.4.0')).toBe(false);
  expect(isNewer('1.3.0', '1.4.0')).toBe(false);
  expect(isNewer('1.4.0', null)).toBe(true);
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement constant + hook**

```ts
// src/constants/changelog.ts
export const CHANGELOG_VERSION = '1.4.0';
export interface ChangelogEntry { version: string; date: string; highlights: string[]; }
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.0',
    date: '2026-06-05',
    highlights: [
      'See who has each tool and where, at a glance — including the last person who held tools now at a location.',
      'Dark mode is now readable across device, location, and add-location screens.',
      'Profile and organization details now save and pre-fill correctly.',
      'Fixed assigning, transferring, and returning tools (clearer errors, no more dead-ends).',
      'Create locations with lowercase postcodes; faster, clearer location screens.',
      'Export reports to CSV and share them.',
      '“Print tags” is now “Browse Devices”; added a “Who has it?” scan and a “Request Device” action.',
    ],
  },
];
```

```ts
// src/hooks/useWhatsNew.ts
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHANGELOG_VERSION } from '@/constants/changelog';

const KEY = 'whatsnew:lastSeenVersion';

export function isNewer(current: string, seen: string | null): boolean {
  if (!seen) return true;
  const c = current.split('.').map(Number);
  const s = seen.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, s.length); i++) {
    const a = c[i] ?? 0, b = s[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

export function useWhatsNew() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((seen) => { if (isNewer(CHANGELOG_VERSION, seen)) setVisible(true); });
  }, []);
  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(KEY, CHANGELOG_VERSION).catch(() => {});
  }, []);
  const openManually = useCallback(() => setVisible(true), []);
  return { visible, dismiss, openManually };
}
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Build `WhatsNewModal.tsx`**

A themed `Modal` rendering `CHANGELOG[0]` (version, date, bulleted `highlights`) with a "Got it" button calling `onDismiss`. Use `useTheme()` colors. Props: `{ visible, onDismiss }`.

- [ ] **Step 6: Mount at root + Settings entry**

In the themed app tree (after auth), instantiate `const wn = useWhatsNew();` and render `<WhatsNewModal visible={wn.visible} onDismiss={wn.dismiss} />`. Expose `openManually` to Settings (via context or a simple module-level event), and add a **"What's New"** row in `src/screens/Settings/sections.ts` that opens the modal on demand.

- [ ] **Step 7: Verify (device)** — fresh install / after bump → modal shows once, dismiss persists; Settings → What's New reopens it. Confirm it triggers after an **OTA** (JS-only) update because `CHANGELOG_VERSION` lives in the bundle.

- [ ] **Step 8: Commit**

```bash
git add src/constants/changelog.ts src/hooks/useWhatsNew.ts src/components/WhatsNewModal.tsx src/tests/unit/changelogVersion.test.ts src/screens/Settings/sections.ts
git commit -m "feat(whats-new): reusable OTA-safe changelog modal (auto + Settings)"
```

---

## Task 18: Version bump + final verification + PR

**Files:**
- Modify: `package.json` (`version` → `1.4.0`), `app.json` (align version), confirm `runtimeVersion` policy per `project_release_ota_setup`.

- [ ] **Step 1: Bump versions** — `package.json` `version: "1.4.0"`; align `app.json` version; keep `CHANGELOG_VERSION === '1.4.0'`.

- [ ] **Step 2: Run the full unit suite**

Run: `npm test -- src/tests/unit`
Expected: your new tests pass; only the ~7 known pre-existing failures remain (compare against baseline).

- [ ] **Step 3: Manual device pass** — walk the spec §5 manual checklist (dark mode, profile, org, add-device, locations, assign/return/transfer, who-has-it, export, what's new).

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin qa-round3-fixes
```
Open a PR summarizing the QA findings addressed and including the **[BACKEND] contract table** from the spec (categories `category` name, `POST /tools/{id}/request/`).

- [ ] **Step 5: Commit any version-bump files**

```bash
git add package.json app.json
git commit -m "chore(release): bump to 1.4.0"
git push
```

---

## Self-Review notes (author)

- **Spec coverage:** A→Task 8; B→Tasks 1–4; C→Tasks 5–6; D→Task 11; E→Tasks 9–10; F→Tasks 7–8; G→Tasks 13–14 (+11); H→Task 17; I→Tasks 4/12/15/16. Donut & tools-flicker (§I) → Tasks 12 & 2. Incident photos (§I) → Task 16 verify.
- **Backend items** (categories store, request route) are built to contract with graceful fallback; flagged in the PR.
- **NFC tasks require hardware** — unit-testable logic is isolated where possible; NFC UI verified on-device.
