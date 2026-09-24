# App Quick Fixes (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the broken mobile flows found in the 2026-09-24 audit and remove the committed service-account key.

**Tech Stack:** Expo SDK 54, React Native, React Navigation 7, Jest + @testing-library/react-native.

**Depends on:** backend branch `fix/platform-hardening` (gmayers/tooltraq):
- Task 8: `DELETE /api/v1/account/`, which returns 409 `last_owner`.
- Task 12: `POST/GET /api/v1/incidents/{id}/photos/`, and reporter PATCH of description/severity.

## Global Constraints
- Branch `fix/app-quick-fixes` from `origin/feat/perf-optimizations` (5ad1929). Independent of PR #17 (notifications).
- Tests: `npm test -- <path>`. Type-check: plain `npx tsc --noEmit -p .` does NOT type-check here (TS5098); use `npx tsc --noEmit -p . --moduleResolution bundler --module esnext`. Files you touch must not gain errors.
- Never `git stash` (shared with the user's main checkout). Never push.
- Commit: subject, blank line, `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Review Focus
1. Navigation params must match what the destination screen reads.
2. Email change must never silently discard input.
3. A worker's incident report with photos must succeed end to end.

---

### Task 1: Remove the committed service-account key
- `git rm fluted-oath-448121-e4-2dd14d76b703.json`.
- Add `*service-account*.json`, `fluted-*.json` and `google-services.json.bak` to `.gitignore`. Don't ignore `google-services.json`; it will be committed intentionally later.
- Confirm nothing references the file (`git grep -n fluted`).
**Commit:** `chore(security): remove committed GCP service-account key`

### Task 2: Dashboard and navigation param bugs
- `src/screens/Dashboard/FleetStatus/FleetStatusScreen.tsx` `handleException`: navigate with `{ reportId }` to ReportDetails and `{ deviceId }` to DeviceDetails.
- grep all `navigate('DeviceDetails'` and `navigate('ReportDetails'` calls (`git grep -n "navigate('DeviceDetails'\|navigate(\"DeviceDetails\"\|navigate('ReportDetails'"`) and fix any other mismatches.
- Two avatar buttons navigate to the unregistered `Profile` route: `LocationsScreen.js:660` and `ReportsScreen.js:220`. Point them at the same destination the dashboards' avatar uses. Check `DashboardHeader onAvatarPress` in ControlRoom/FleetStatus; it's probably the settings tab or `EditProfile`.
**Tests:**
- A FleetStatus exception tap navigates with `deviceId` and with `reportId`; extend the existing Dashboard tests or add a FleetStatus test.
- The avatar press on Locations and Reports navigates to a registered route.
**Commit:** `fix(nav): pass the params detail screens read; avatar goes to a real screen`

### Task 3: Email change
- In `EditProfileScreen.js`, stop sending `email` in `PATCH /account/`.
- If the email field changed, call `POST /account/email/change/` and then show a code entry that calls `POST /account/email/confirm/`. Add endpoint functions to `src/api/endpoints/account.ts`; read the backend schemas in `docs/api/openapi.json`: EmailChangeRequestPayload, EmailChangeRequested, the confirm payload, EmailChangeConfirmed.
- On success, `refreshUser()`. Show API errors (invalid code, rate-limited) with the existing error pattern in that screen.
- If the email didn't change, behave exactly as now for the other fields.
**Tests:**
- Saving without an email change PATCHes without an `email` key.
- Changing the email calls `email/change` and then shows the code input.
- Confirming calls `email/confirm` and refreshes the user.
- Error states are shown.
**Commit:** `fix(profile): change email through the verified email-change flow`

### Task 4: Worker incident photos and report edits
- `CreateReportScreen.js`: after `createIncident`, upload photos and signature with the new `POST /incidents/{id}/photos/` (add `uploadIncidentPhoto(incidentId, file)` to `src/api/endpoints/incidents.ts`) instead of `uploadToolPhoto`.
- `ReportDetailsScreen.js`: show the incident's own photos via `GET /incidents/{id}/photos/`, not every photo on the tool.
- `AllReportsScreen.js` / `ReportDetailsScreen.js`: a reporter who isn't an officer may edit only description and severity. Hide status controls for them, since the backend now allows reporter PATCH of those fields only.
- `DeviceDetailsScreen.js`: call `listIncidents({tool})` only for owner/admin (it's officer-only on the backend). Workers see no incidents section instead of an error.
- Report delete stub (`ReportDetailsScreen.js` ~270-276): wire it to `deleteIncident` for officers. Hide it for everyone else.
**Tests:**
- A worker's report creation uploads via the incident photo endpoint.
- The DeviceDetails incident list isn't requested for workers.
- The reporter edit hides status.
- An officer delete calls `deleteIncident` and navigates back.
**Commit:** `fix(reports): incident photos, reporter edits and delete`

### Task 5: Account deletion handles `last_owner`
- In the SettingsScreen delete-account flow (and `AuthContext.deleteAccount`), a 409 with code `last_owner` from `DELETE /account/` shows "Transfer ownership to another member before deleting your account." and keeps the user signed in.
- Other errors show the existing generic error.
**Tests:** 409 `last_owner` shows the specific message and doesn't sign out; 204 signs out (existing behaviour).
**Commit:** `fix(settings): explain when account deletion needs an ownership transfer`

### Task 6: Full suite and type-check
- Run `npx jest` (the 7 pre-existing failing suites are acceptable: Button, FormField, PasswordField, AuthFlow e2e + integration, NFCService, NFCUtils) and the working tsc command.
- Report the results. No commit unless something needs fixing.
