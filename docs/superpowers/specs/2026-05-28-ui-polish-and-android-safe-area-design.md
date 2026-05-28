# UI Polish & Android Safe-Area Audit — Design

**Date:** 2026-05-28
**Scope:** Three independent UI changes shipped as one spec.
**Status:** Approved by user (sections 1–3), pending implementation plan.

## Goals

1. Fix the broken NFC unknown-tag → "Register this tag" flow so it actually prefills the tag UID on `AddDeviceScreen`.
2. Visual overhaul of the Tools list screen — improve readability, hierarchy, and admin toggle UX.
3. Standardize Android (and iOS) safe-area handling across all screens so headers, content, and bottom tab bar no longer collide with the status bar, gesture nav, or each other.

## Non-Goals

- Changing the data model or API surface (tools, assignments, incidents).
- Reskinning the bottom tab bar visuals.
- Adopting Android 15 edge-to-edge / immersive layouts.
- Reworking the registered-device branch of `QuickActionModalScreen` (it works).
- Adding tools search, pull-to-refresh, or multi-select.

---

## Section 1 — NFC unknown-tag flow

### Problem

When a user scans an NFC tag that isn't registered to any tool, `QuickActionModalScreen` shows a "Tag not registered" empty state with a "Register this tag" button. The button calls:

```
navigation.replace('AddDevice', { prefilledTagUid: tagUID })
```

But `AddDeviceScreen.js` **never reads `route.params?.prefilledTagUid`**. It only sets `preScannedNfcTagId` when the user manually scans inside the form (line 586). Net effect: the user lands on the Add Device form and the tag UID they just scanned is lost.

Permissions are correct today: admin/owner sees the Register button; site workers see a "Ask an admin" message.

### Changes

**`src/screens/AddDeviceScreen.js`**

- Add `useRoute` (or a `route` prop) and read `route.params?.prefilledTagUid` on mount.
- If present, call `setPreScannedNfcTagId(prefilledTagUid)` in a `useEffect` keyed on `route.params?.prefilledTagUid` (run once).
- The rest of the form flow already consumes `preScannedNfcTagId` correctly (lines 368–370, 394, 902, 906, 974, 984).
- Add a small banner row at the top of the form (above the existing inputs) that reads `Linking to tag <UID>` when `preScannedNfcTagId` is set, using `colors.surfaceAlt` background and the existing nfcTagId style.

**`src/screens/QuickAction/QuickActionModalScreen.tsx`** (lines 295–315, the `notFound` branch)

- Title: `Tag not registered` (unchanged).
- Body: `This NFC tag isn't linked to any device yet.` (Move the long UID out of the body sentence and into a smaller meta line below.)
- New `Text` line below body: `UID: {tagUID}` in `colors.textMuted`, smaller font.
- Primary button (admin/owner only): rename `Register this tag` → `Add new device`. Keep the existing `handleRegisterTag` handler.
- Secondary action: add a `Close` button below the primary, styled as `variant="ghost"`, calling the existing `handleClose`.
- Non-admin: keep the "Ask an admin or owner..." copy, but add an explicit `Close` button so it dismisses cleanly.

### Acceptance

- Scan an unregistered tag as admin → "Tag not registered" screen with UID visible → tap "Add new device" → Add Device form opens with the tag UID banner visible at top → submit creates a tool with `nfc_tag_id` set to the scanned UID.
- Scan an unregistered tag as site worker → "Ask an admin" message + Close button. Close dismisses back to the previous screen.
- Existing registered-tag flow (View details, Return, Report, Assign, Upgrade) unchanged.

---

## Section 2 — Tools list styling

### Problem

`ToolsScreen.tsx` and its children look cramped and visually weak:
- Rows are tight (12pt vertical padding, no leading visual).
- Status chip is 11pt with low-contrast 22% alpha bg — hard to read.
- Site group header is just emoji + title on a tinted band — feels like a row, not a section.
- Admin Mine/All toggle floats at the top with no screen title context.
- No screen title or visual anchor; the list dives straight into rows under the safe-area inset.

### Changes

**`src/screens/Tools/components/ToolsListItem.tsx`**

- Leading icon: 40dp circle with `colors.primary` at 14% alpha background, containing `Ionicons name="construct-outline"` in `colors.primary`. (A category-to-icon mapping is out of scope; use the same icon for all rows.)
- Identifier text: `fontSize: 16`, `fontWeight: '600'`.
- Tool-type text: `fontSize: 13`, marginTop `2`.
- Add a third meta line when assignee/site info is available: `Assigned to {name}` or `At {siteName}` using `colors.textMuted`, `fontSize: 12`. (Pull from existing `ToolItem` shape; if the field isn't present yet, surface it via `useMyTools` — see hook note below.)
- Status chip:
  - `fontSize: 12`, `fontWeight: '700'`.
  - Padding `10/5`.
  - Background `chipColor + '2E'` (18% alpha) instead of 22%.
  - Border stays full-strength `chipColor`.
  - Position chip in the row, right-aligned, with chevron last.
- Row container: padding `20/14`, `minHeight: 64`. Add `gap: 12` between leading icon and info.

**`src/screens/Tools/components/SiteGroupHeader.tsx`**

- Replace emoji map with `Ionicons` map: `location: 'location-outline'`, `van: 'bus-outline'`, `toolbox: 'briefcase-outline'`. Icon color `colors.primary`.
- Title: `fontSize: 13`, `textTransform: 'uppercase'`, `letterSpacing: 0.5`, `fontWeight: '700'`, color `colors.textSecondary`.
- Tool count: replace plain `{count} tools` with a small pill — circular-ish badge with `colors.surfaceAlt` background, `paddingHorizontal: 8`, `paddingVertical: 2`, `borderRadius: 10`, just `{count}` text in `colors.textPrimary`.
- Add a `borderBottomWidth: StyleSheet.hairlineWidth` and `borderBottomColor: colors.borderLight` to the header so each section is visually anchored.
- Padding: `12 / 10`.

**`src/screens/Tools/components/AdminToolsToggle.tsx`**

- Container: drop `borderWidth`, set `borderRadius: 10`, padding `4`. Background `colors.surfaceAlt`.
- Each option: `paddingVertical: 8`, `paddingHorizontal: 14`, `borderRadius: 8`.
- Active option: background `colors.primary`, text `colors.onPrimary` (or white if `onPrimary` is missing). Add subtle elevation: `shadowOpacity: 0.08`, `shadowOffset: { width: 0, height: 1 }`, `shadowRadius: 2` (iOS); `elevation: 2` (Android).
- Inactive: `color: colors.textSecondary`, no background.
- Width: shrink — make the toggle hug content rather than spanning full width. Keep label text short ("My Tools" / "All Tools").

**`src/screens/Tools/ToolsScreen.tsx`**

- Add a screen header bar above the SectionList (since the tab nav uses `headerShown: false`):
  - Row, `paddingHorizontal: 20`, `paddingVertical: 12`.
  - Left: `Tools` title in `colors.textPrimary`, `fontSize: 22`, `fontWeight: '700'`.
  - Right: admin toggle (only for admin/owner), inline with the title.
  - 1px `colors.borderLight` divider under the row.
- Remove the existing `toggleWrap` view; it's replaced by the header row.
- `SectionList`: `contentContainerStyle={{ paddingBottom: 24 }}`. Keep `stickySectionHeadersEnabled`.
- Empty state: same copy, but wrap in a card-like view with `padding: 32`, icon (`construct-outline`, large, muted), and the copy below.

**`src/screens/Tools/hooks/useMyTools.ts` (light touch)**

- Confirm `ToolItem` exposes the current assignee (`assigneeName`) and/or the current site name. If not, derive from the existing assignment data so `ToolsListItem` can show the third meta line. No API changes required.

### Acceptance

- Visit Tools tab → see "Tools" title at top with admin toggle to the right (if admin).
- Each row has a leading icon, three lines (identifier / type / context), readable status chip, chevron.
- Section headers are uppercase labels with an icon and a count pill, divider underneath.
- Mine/All toggle has a pill segmented control look, not a bordered box.
- Empty state is centered with an icon and clear copy.

---

## Section 3 — Android header/toolbar & safe-area standardization

### Problem

Survey of `src/screens` revealed three patterns mixed across ~30 screens:

1. **Custom header height override** in `MainStack` (`navigation/index.tsx:137`): `Platform.OS === 'ios' ? 44 + insets.top : 56`. On Android this ignores the status bar inset and conflicts with React Navigation's built-in `headerStatusBarHeight` insertion.
2. **`<SafeAreaView>` with no `edges` prop** in `AllReportsScreen`, `AllDevicesScreen`, `DeviceDetailsScreen`, `ReportDetailsScreen`, etc. Defaults to all four edges → double-padded with bottom tabs and the keyboard on Android.
3. **Hardcoded magic paddings**, e.g. `ReportDetailsScreen.js:978` `paddingTop: Platform.OS === 'ios' ? 60 : 40`.

The bottom tab bar (`MainTabBar`) also doesn't pad for Android gesture-nav inset.

### Design

**New component: `src/components/ScreenScaffold.tsx`**

A small wrapper that codifies the correct pattern. Signature:

```ts
interface ScreenScaffoldProps {
  /**
   * Which safe-area edges to apply. Default: ['top'].
   * - Pass [] when a parent (tab nav or stack header) already pads top.
   * - Pass ['top', 'bottom'] for modal-style screens with no header AND no tab bar.
   */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /**
   * StatusBar bar style. Default derives from theme: 'dark-content' on light
   * themes, 'light-content' on dark.
   */
  statusBarStyle?: 'dark-content' | 'light-content';
  /** Background color. Default: theme's colors.background. */
  backgroundColor?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}
```

Implementation:

- Wraps children in `SafeAreaView` from `react-native-safe-area-context`.
- Reads `useTheme()` for default background.
- Renders `<StatusBar barStyle={effectiveBarStyle} />` at the top. (Uses `react-native` `StatusBar`, not `expo-status-bar`, to stay consistent with the existing import surface.)

**Navigation header cleanup — `src/navigation/index.tsx`**

- Remove `height: Platform.OS === 'ios' ? 44 + insets.top : 56` from `getHeaderStyle()`. Let React Navigation compute height (it already inserts `headerStatusBarHeight` automatically on Android).
- Remove the now-unused `useSafeAreaInsets()` import in `MainStack` if nothing else uses it.
- Keep the other style props (`backgroundColor`, `elevation: 0`, `shadowOpacity: 0`, `borderBottomWidth: 1`, `borderBottomColor`).

**Bottom-nav clearance — `src/navigation/MainTabBar.tsx`**

- Apply `paddingBottom: insets.bottom` (from `useSafeAreaInsets()`) to the tab bar container so it clears the Android gesture-nav pill and the iPhone home indicator.

**Per-screen migration**

Group all screens by their relationship to navigation chrome and apply the right `edges` prop. Migration is mechanical: replace `<SafeAreaView>` (from `react-native-safe-area-context`) with `<ScreenScaffold edges={...}>`. Files in scope:

| Screen | Header source | `edges` |
|---|---|---|
| Dashboard, Tools, Sites, Settings, Incidents | Tab nav (already pads top) | `[]` |
| AllReports, AllDevices, DeviceDetails, ReportDetails, Members, Subscribe, QuickActionModal | None (`headerShown: false`) | `['top']` |
| AddDevice, CreateReport, LocationDetails, EditProfile, ChangePassword, NotificationPreferences, PaymentHistory, BillingAnalytics, SuggestFeature, ManageBilling, DataHandlingFee, CreateOrganization, Pricing, ForgotPassword, Register, VerifyEmail | Stack header | `[]` |
| Login (Auth root) | None | `['top']` |

For screens that have a sticky bottom CTA (e.g. `CreateReport` Submit button), the screen reads `useSafeAreaInsets().bottom` itself and applies it to the CTA container — `ScreenScaffold` does not pad bottom by default because most screens are tabbed or stacked.

**Magic-number fixes**

- `ReportDetailsScreen.js:978` `paddingTop: Platform.OS === 'ios' ? 60 : 40` → remove (the parent SafeAreaView from `ScreenScaffold edges={['top']}` makes this redundant; if the visual gap was intentional design margin, replace with a uniform `paddingTop: 16` on the content container).
- Audit other screens for similar Platform.OS === 'ios' ? N : M paddings in the rendered tree and remove if `ScreenScaffold` handles them; keep them only if the comment makes clear they're intentional design margins, not safe-area workarounds.

### Acceptance

- Open the app on Android with a status bar and gesture-nav pill: no screen content sits behind the status bar, no tab button sits behind the gesture pill.
- Open the same screens on iOS notched device: no regression — top inset still respected, no double-padding.
- Stack headers render at native height (44pt on iOS plus status bar, ~56dp on Android plus status bar) without the previous hardcoded override.
- `ScreenScaffold` is the only safe-area wrapper imported by screen files; no screen directly imports `SafeAreaView` from `react-native-safe-area-context` (except `MainTabNavigator`, which legitimately uses it as the tab root).
- Bottom-tab bar visually clears the home indicator / gesture pill on every device tested.

---

## Build sequence

Implement in this order — each step lands a verifiable visible change without breaking the rest:

1. **Section 1** (smallest scope, fixes a real bug):
   1. Wire `prefilledTagUid` into `AddDeviceScreen`.
   2. Update `QuickActionModalScreen` copy + close button.
2. **Section 3** (foundation for clean Section 2):
   1. Create `ScreenScaffold`.
   2. Remove the custom header height override in `MainStack`.
   3. Migrate one tab screen (Tools) and one headerless detail screen (DeviceDetails) as a pattern reference.
   4. Apply `MainTabBar` bottom inset.
   5. Migrate the remaining screens in the table.
   6. Remove magic-number paddings.
3. **Section 2** (lands on the standardized scaffold):
   1. Update `ToolsListItem`.
   2. Update `SiteGroupHeader`.
   3. Update `AdminToolsToggle`.
   4. Update `ToolsScreen` to wrap in a screen-header row + scaffold.
   5. Update `useMyTools` if needed to surface assignee/site context.

## Testing

- Unit tests: existing tests in `src/screens/Tools/` and `src/screens/QuickAction/` (if any) should continue to pass.
- Manual test matrix: Android + iOS, light theme + dark theme, Android with and without 3-button nav vs. gesture nav, iOS with and without notch / dynamic island.
- Specific manual checks:
  - Scan unknown tag as admin → "Add new device" → tag UID prefilled in form.
  - Scan unknown tag as site worker → close dismisses cleanly.
  - Tools tab: rows readable, status chips clear, site group headers feel like sections, admin toggle inline with title.
  - Every screen in the table above does not collide with status bar or gesture nav.
  - `ReportDetailsScreen` no longer has a phantom top gap.

## Risks

- **Header height removal** could shift the visible header by ~1–2dp on existing screens that visually depend on the exact 56dp. Mitigation: spot-check `AddDevice`, `CreateReport`, `EditProfile` headers post-change.
- **Bottom tab bar inset** may visually shift the tab bar up on devices that already had system inset handling. Mitigation: only apply when `insets.bottom > 0` so it's a no-op on devices without one.
- **`ToolsListItem` icon mapping** depends on tool category strings; unknown categories fall back to `construct-outline`.
