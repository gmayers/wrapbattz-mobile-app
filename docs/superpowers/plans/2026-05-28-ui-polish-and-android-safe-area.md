# UI Polish & Android Safe-Area — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land three bundled UI fixes — NFC unknown-tag flow correctness, Tools list visual overhaul, and a standardized safe-area scaffold across all screens.

**Architecture:** Phase 1 fixes a single broken navigation param (smallest scope first). Phase 2 introduces a `ScreenScaffold` component and migrates every screen to use it, removing custom header heights and magic paddings. Phase 3 redesigns the Tools list on top of the now-stable foundation.

**Tech Stack:** React Native 0.81 + Expo SDK 54, React Navigation v7 (stack + bottom tabs), `react-native-safe-area-context`, `@expo/vector-icons` (Ionicons), themed via `useTheme()` from `src/context/ThemeContext.js`.

**Spec:** `docs/superpowers/specs/2026-05-28-ui-polish-and-android-safe-area-design.md`

---

## File Map

**Created**
- `src/components/ScreenScaffold.tsx` — reusable safe-area wrapper.

**Modified — Phase 1 (NFC unknown-tag)**
- `src/screens/AddDeviceScreen.js` — read `route.params.prefilledTagUid`, show banner.
- `src/screens/QuickAction/QuickActionModalScreen.tsx` — copy + Close button.

**Modified — Phase 2 (safe-area)**
- `src/navigation/index.tsx` — remove custom header height override.
- All screen files in the migration table (see Task 8). Roughly 25 files; mechanical replacement of `SafeAreaView` with `ScreenScaffold edges={...}`.
- `src/screens/ReportDetailsScreen.js` — remove magic `paddingTop`.

**Modified — Phase 3 (Tools list)**
- `src/screens/Tools/hooks/useMyTools.ts` — extend `ToolItem`, stop overloading `toolType`.
- `src/screens/Tools/components/ToolsListItem.tsx` — full rewrite.
- `src/screens/Tools/components/SiteGroupHeader.tsx` — full rewrite.
- `src/screens/Tools/components/AdminToolsToggle.tsx` — full rewrite.
- `src/screens/Tools/ToolsScreen.tsx` — add screen header row, restyle empty state.

---

## Phase 1 — NFC Unknown-Tag Flow

### Task 1: Wire `prefilledTagUid` into AddDeviceScreen

**Files:**
- Modify: `src/screens/AddDeviceScreen.js:38` (component signature) and inside the component body (effect)

- [ ] **Step 1: Read `route` prop**

Change line 38 from:
```js
const AddDevicePage = ({ navigation }) => {
```
to:
```js
const AddDevicePage = ({ navigation, route }) => {
```

- [ ] **Step 2: Seed `preScannedNfcTagId` from route param**

Just after the existing `useState` declarations (after the block ending at line 111 with `setIsUserAssignment`), insert a new `useEffect`:

```js
  // Seed pre-scanned NFC tag from navigation param (set when the user comes
  // here via QuickActionModal → "Add new device" for an unregistered tag).
  useEffect(() => {
    const fromParams = route?.params?.prefilledTagUid;
    if (fromParams && !preScannedNfcTagId) {
      setPreScannedNfcTagId(String(fromParams).toUpperCase());
    }
  }, [route?.params?.prefilledTagUid]);
```

Note: `useEffect` is already imported on line 1.

- [ ] **Step 3: Verify Metro reloads cleanly**

Run: `npm test -- src/screens/AddDeviceScreen 2>&1 | tail -20`
Expected: No new test failures (there may be no tests for this file — that's OK; we just want type/import errors to surface).

- [ ] **Step 4: Commit**

```bash
git add src/screens/AddDeviceScreen.js
git commit -m "fix(add-device): consume prefilledTagUid from navigation params

Previously QuickActionModalScreen passed prefilledTagUid when navigating to
AddDevice for an unregistered tag, but AddDeviceScreen ignored the param so
the tag UID was lost. Read route.params.prefilledTagUid on mount and seed
preScannedNfcTagId from it."
```

---

### Task 2: Update QuickActionModalScreen copy + add Close button

**Files:**
- Modify: `src/screens/QuickAction/QuickActionModalScreen.tsx:295-315` (the `notFound` branch)

- [ ] **Step 1: Replace the not-found branch JSX**

Find this block (lines 295–315):

```tsx
      ) : notFound ? (
        <View style={styles.centered} testID="quick-action-not-found">
          <Ionicons name="help-circle-outline" size={42} color={colors.warning || colors.primary} />
          <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
            Tag not registered
          </Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            No device is linked to this NFC tag (UID: {tagUID}).
          </Text>
          {isAdminOrOwner ? (
            <Button
              title="Register this tag"
              onPress={handleRegisterTag}
              style={styles.primaryBtn}
            />
          ) : (
            <Text style={[styles.hintText, { color: colors.textSecondary, marginTop: 8 }]}>
              Ask an admin or owner to register this tag.
            </Text>
          )}
        </View>
      ) : device ? (
```

Replace with:

```tsx
      ) : notFound ? (
        <View style={styles.centered} testID="quick-action-not-found">
          <Ionicons name="help-circle-outline" size={42} color={colors.warning || colors.primary} />
          <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
            Tag not registered
          </Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            This NFC tag isn't linked to any device yet.
          </Text>
          <Text style={[styles.uidMeta, { color: colors.textMuted }]}>
            UID: {tagUID}
          </Text>
          {isAdminOrOwner ? (
            <>
              <Button
                title="Add new device"
                onPress={handleRegisterTag}
                style={styles.primaryBtn}
                testID="quick-action-add-new-device"
              />
              <Button
                title="Close"
                onPress={handleClose}
                variant="ghost"
                style={styles.secondaryBtn}
                testID="quick-action-not-found-close"
              />
            </>
          ) : (
            <>
              <Text style={[styles.hintText, { color: colors.textSecondary, marginTop: 8 }]}>
                Ask an admin or owner to register this tag.
              </Text>
              <Button
                title="Close"
                onPress={handleClose}
                variant="ghost"
                style={styles.secondaryBtn}
                testID="quick-action-not-found-close"
              />
            </>
          )}
        </View>
      ) : device ? (
```

- [ ] **Step 2: Add the two new styles**

In the `StyleSheet.create({...})` block at the bottom (after `primaryBtn` at line 498–501), add:

```tsx
  uidMeta: {
    fontSize: 12,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  secondaryBtn: {
    marginTop: 8,
    minWidth: 180,
  },
```

Also add `Platform` to the existing `react-native` import at the top of the file (line 3–11). The current import block reads:

```tsx
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
```

Add `Platform`:

```tsx
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
```

- [ ] **Step 3: Manual smoke check**

Run: `npm test -- src/screens/QuickAction 2>&1 | tail -20`
Expected: No new failures; if no tests exist, command exits 0 with "No tests found".

- [ ] **Step 4: Commit**

```bash
git add src/screens/QuickAction/QuickActionModalScreen.tsx
git commit -m "feat(nfc-modal): clearer unknown-tag copy + explicit Close button

Promote UID to its own meta line, rename CTA to 'Add new device', and add a
Close button for both admin and non-admin states so dismissal is obvious."
```

---

## Phase 2 — Safe-Area Standardization

### Task 3: Create `ScreenScaffold` component

**Files:**
- Create: `src/components/ScreenScaffold.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/ScreenScaffold.tsx
//
// Standard screen-level wrapper. Codifies safe-area + status-bar handling so
// individual screens don't reinvent the same pattern. Use this in place of
// SafeAreaView directly from 'react-native-safe-area-context' for any
// top-level screen content.

import React from 'react';
import { StatusBar, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export interface ScreenScaffoldProps {
  /**
   * Which safe-area edges to pad. Default: ['top'].
   * - Pass [] when a parent (tab nav or stack header) already pads top.
   * - Pass ['top', 'bottom'] for modal-style screens with no header AND no
   *   tab bar (e.g. fullscreen onboarding modals).
   */
  edges?: Edge[];
  /**
   * StatusBar bar style. Default: 'dark-content' — flip explicitly if the
   * theme background is dark.
   */
  statusBarStyle?: 'dark-content' | 'light-content';
  /** Background color. Default: theme's colors.background. */
  backgroundColor?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

const ScreenScaffold: React.FC<ScreenScaffoldProps> = ({
  edges = ['top'],
  statusBarStyle = 'dark-content',
  backgroundColor,
  children,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const bg = backgroundColor ?? colors.background;

  // When no edges are requested, skip SafeAreaView entirely — it would still
  // insert a wrapper with no effect, and a plain View keeps the tree thinner.
  if (edges.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: bg }, style]} testID={testID}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={bg} />
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: bg }, style]}
      testID={testID}
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={bg} />
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default ScreenScaffold;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep ScreenScaffold | head -5`
Expected: No output (file passes type-check).

If `tsc` is not configured for the project, use `npm run test:ci 2>&1 | tail -20` and confirm no import-resolution errors mentioning `ScreenScaffold`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ScreenScaffold.tsx
git commit -m "feat(scaffold): add ScreenScaffold safe-area wrapper

Centralizes safe-area edges + status bar style + background so screens stop
re-implementing the same pattern with inconsistent edges and magic paddings."
```

---

### Task 4: Remove custom header height in MainStack

**Files:**
- Modify: `src/navigation/index.tsx:127-138` (the `MainStack` getHeaderStyle helper)

- [ ] **Step 1: Drop the height override**

Find this block (lines 127–138):

```tsx
const MainStack = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const getHeaderStyle = () => ({
    backgroundColor: colors.background,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    height: Platform.OS === 'ios' ? 44 + insets.top : 56,
  });
```

Replace with:

```tsx
const MainStack = () => {
  const { colors } = useTheme();

  const getHeaderStyle = () => ({
    backgroundColor: colors.background,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  });
```

- [ ] **Step 2: Remove the now-unused imports**

At the top of the file (lines 7–8):

```tsx
import { ActivityIndicator, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
```

`Platform` and `useSafeAreaInsets` are no longer used in `MainStack`. Check the rest of the file with:

```bash
grep -n "Platform\|useSafeAreaInsets" src/navigation/index.tsx
```

If no other usages remain, change the two import lines to:

```tsx
import { ActivityIndicator, View } from 'react-native';
```

…and delete the `react-native-safe-area-context` import line entirely.

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit -p . 2>&1 | grep "navigation/index" | head -5`
Expected: No output.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/index.tsx
git commit -m "fix(nav): let React Navigation compute header height

Custom height override (44 + insets.top on iOS, 56 on Android) fought RN's
built-in headerStatusBarHeight insertion on Android. Remove it; the default
sizing handles status bar correctly on both platforms."
```

---

### Task 5: Migrate Tools tab to ScreenScaffold (reference example #1)

**Files:**
- Modify: `src/screens/Tools/ToolsScreen.tsx`

This is a tab child — its parent `MainTabNavigator` already wraps in `SafeAreaView edges={['top']}`, so the screen itself uses `edges={[]}`.

- [ ] **Step 1: Replace root `View` with `ScreenScaffold`**

The current file imports `View` from `react-native` and uses it as the root container at line 34:

```tsx
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
```

Change to use `ScreenScaffold`. Update the top imports — add:

```tsx
import ScreenScaffold from '../../components/ScreenScaffold';
```

And remove `View` from the `react-native` import if nothing else in the file uses it (the loader path at line 26 uses `View`, so keep `View` for now).

Wrap the return value (both the loading-state branch and the main render) so they each return a `ScreenScaffold`. Replace the whole component body return with:

```tsx
  if (isLoading) {
    return (
      <ScreenScaffold edges={[]}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading tools…</Text>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold edges={[]}>
      {isAdminOrOwner ? (
        <View style={styles.toggleWrap}>
          <AdminToolsToggle value={filter} onChange={setFilter} />
        </View>
      ) : null}
      <SectionList
        sections={sections as any}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => <SiteGroupHeader group={(section as any).group} />}
        renderItem={({ item }) => <ToolsListItem item={item} onPress={handleToolPress} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No tools yet. Tap Scan to check a tag.
            </Text>
          </View>
        }
        stickySectionHeadersEnabled
      />
    </ScreenScaffold>
  );
```

Drop the `root` style (no longer needed):

```tsx
const styles = StyleSheet.create({
  toggleWrap: { padding: 12 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 10, fontSize: 14 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
```

- [ ] **Step 2: Verify**

Run: `npm test -- src/screens/Tools 2>&1 | tail -20`
Expected: No new failures.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Tools/ToolsScreen.tsx
git commit -m "refactor(tools): wrap ToolsScreen in ScreenScaffold

Tab child — parent tab navigator already provides the top safe-area inset,
so pass edges=[] to avoid double-padding."
```

---

### Task 6: Migrate DeviceDetailsScreen to ScreenScaffold (reference example #2)

**Files:**
- Modify: `src/screens/DeviceDetailsScreen.js` (replace three `<SafeAreaView>` wrappers at lines 281, 301, 329)

DeviceDetails is a headerless stack screen — `headerShown: false` in `MainStack`. No parent provides top inset, so use `edges={['top']}`.

- [ ] **Step 1: Replace imports**

At the top of `src/screens/DeviceDetailsScreen.js`:

```js
import { SafeAreaView } from 'react-native-safe-area-context';
```

Change to:

```js
import ScreenScaffold from '../components/ScreenScaffold';
```

- [ ] **Step 2: Replace all three `<SafeAreaView>` usages**

The file uses `<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>` at three points (lines 281, 301, 329) and the matching closing tag.

Replace every `<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>` with:

```jsx
<ScreenScaffold edges={['top']}>
```

…and every matching `</SafeAreaView>` with `</ScreenScaffold>`.

(There are 3 open tags and 3 close tags. Verify with `grep -c "SafeAreaView" src/screens/DeviceDetailsScreen.js` — should print `0` after the edits, except for the now-removed import line.)

- [ ] **Step 3: Drop the `container` style if obsolete**

In the styles block, find the `container` style. If it only contains `flex: 1`, remove it; `ScreenScaffold` already does this. If it has additional properties, keep them but apply via `style` prop on `ScreenScaffold`.

Quick check:
```bash
grep -A2 "container:" src/screens/DeviceDetailsScreen.js | head -10
```
If it's `{ flex: 1 }` only, delete the style entry and any leftover references.

- [ ] **Step 4: Run tests**

Run: `npm test -- DeviceDetails 2>&1 | tail -10`
Expected: No new failures.

- [ ] **Step 5: Commit**

```bash
git add src/screens/DeviceDetailsScreen.js
git commit -m "refactor(device-details): wrap in ScreenScaffold edges=['top']

Headerless stack screen; no parent provides top inset so request it
explicitly via ScreenScaffold."
```

---

### Task 7: Remove magic top-padding in ReportDetailsScreen

**Files:**
- Modify: `src/screens/ReportDetailsScreen.js:978`

- [ ] **Step 1: Find the offending style**

Run: `grep -n "paddingTop:" src/screens/ReportDetailsScreen.js | head -5`

Confirm there is a line approximately matching:
```js
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
```

- [ ] **Step 2: Remove or replace**

If the style belongs to a top-level container that will be wrapped by `ScreenScaffold edges={['top']}` (Task 9), remove the entire `paddingTop` line. The safe-area inset takes over the role of pushing content below the status bar.

If removing makes the content visually touch the screen header below, replace with a plain design margin instead:

```js
    paddingTop: 16,
```

The right choice depends on whether the gap was for safe-area or for design rhythm. Looking at the surrounding context (e.g. `scrollContent` or similar style name) and the actual visual rendering will tell you. Default to removing entirely; add `paddingTop: 16` only if the visual spacing was clearly intentional.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ReportDetailsScreen.js
git commit -m "fix(report-details): drop magic-number top padding

paddingTop: Platform.OS === 'ios' ? 60 : 40 was approximating safe-area
manually. ScreenScaffold edges=['top'] (added in following task) handles it
correctly."
```

---

### Task 8: Migrate remaining tab-child screens (edges=`[]`)

These tab children inherit top safe-area from `MainTabNavigator`. Each gets `edges={[]}`.

**Files:**
- `src/screens/Dashboard/DashboardScreen.tsx`
- `src/screens/Sites/SitesScreen.tsx`
- `src/screens/Settings/SettingsScreen.tsx`
- `src/screens/Incidents/IncidentsScreen.tsx` (currently just re-exports `ReportsScreen` — `ReportsScreen.js` is the real target; see Task 8b below.)

- [ ] **Step 1: For each file (Dashboard, Sites, Settings, ReportsScreen.js), find the root container**

Most use either `<View>` or `<SafeAreaView>` from `react-native-safe-area-context` as the outermost element of their main render. For each file:

1. Add `import ScreenScaffold from '../../components/ScreenScaffold';` (adjust the relative path: `DashboardScreen` is at `src/screens/Dashboard/`, so use `'../../components/ScreenScaffold'`; `ReportsScreen.js` is at `src/screens/`, so use `'../components/ScreenScaffold'`).
2. Wrap the outermost return JSX in `<ScreenScaffold edges={[]}>...</ScreenScaffold>`.
3. If the file imports `SafeAreaView` from `react-native-safe-area-context` and uses it as that outermost element, replace the open + close tags.
4. Drop any `flex: 1` container style that is now redundant.

- [ ] **Step 2: Verify after each file**

For each file edited, run:
```bash
npm test -- <screen-file-basename> 2>&1 | tail -5
```

Expected: No new failures.

- [ ] **Step 3: Commit each as you go (or batch — your call)**

Either one commit per file or a single batch commit `refactor(screens): migrate tab children to ScreenScaffold edges=[]`.

---

### Task 9: Migrate headerless stack screens (edges=`['top']`)

These have `headerShown: false` in `MainStack`. No parent provides top inset.

**Files:**
- `src/screens/AllReportsScreen.js`
- `src/screens/AllDevicesScreen.js`
- `src/screens/ReportDetailsScreen.js`
- `src/screens/Members/MembersScreen.tsx`
- `src/screens/Subscribe/SubscribeScreen.tsx`
- (DeviceDetailsScreen done in Task 6; QuickActionModal done implicitly — see Step 4 below)

For each file:

- [ ] **Step 1: Replace `SafeAreaView` from `react-native-safe-area-context` with `ScreenScaffold edges={['top']}`**

For files that already pass `edges={['top']}` to `SafeAreaView` (e.g. `MembersScreen.tsx:240`, `SubscribeScreen.tsx:170`), the migration is purely a name swap — open and close tags only.

For files that pass no `edges` prop (`AllReportsScreen.js`, `AllDevicesScreen.js`, `ReportDetailsScreen.js`), explicitly pass `edges={['top']}` and verify there is no fixed-position bottom UI that needs `bottom` padding (e.g. a sticky submit bar). If there is, that element should consume `useSafeAreaInsets().bottom` directly inside the screen.

- [ ] **Step 2: Audit QuickActionModalScreen**

`QuickActionModalScreen.tsx` currently uses a plain `<View>` as its root with no safe-area handling. It's rendered as a modal (presentation: 'modal' in MainStack). Modal presentation on iOS provides top inset automatically; Android does not.

Edit `src/screens/QuickAction/QuickActionModalScreen.tsx` line 262 from:

```tsx
    <View style={[styles.root, { backgroundColor: colors.background }]}>
```

To:

```tsx
    <ScreenScaffold edges={['top']}>
```

…and the closing `</View>` at line 434 to `</ScreenScaffold>`. Add the import at the top.

Drop the `root` style entry from the styles block.

- [ ] **Step 3: Run tests**

Run: `npm test 2>&1 | tail -30`
Expected: No new failures across the suite.

- [ ] **Step 4: Commit**

```bash
git add src/screens/AllReportsScreen.js src/screens/AllDevicesScreen.js src/screens/ReportDetailsScreen.js src/screens/Members/MembersScreen.tsx src/screens/Subscribe/SubscribeScreen.tsx src/screens/QuickAction/QuickActionModalScreen.tsx
git commit -m "refactor(screens): migrate headerless screens to ScreenScaffold

Headerless stack screens use edges=['top'] since no parent provides the
status-bar inset. Removes ad-hoc and missing safe-area handling."
```

---

### Task 10: Migrate header-shown stack screens (edges=`[]`)

These screens have a React Navigation stack header rendered above them. The header handles the top inset, so screens should use `edges={[]}`.

**Files:**
- `src/screens/AddDeviceScreen.js`
- `src/screens/CreateReportScreen.js`
- `src/screens/LocationDetailsScreen.js`
- `src/screens/EditProfileScreen.js`
- `src/screens/ChangePassword/ChangePasswordScreen.tsx`
- `src/screens/PaymentScreens/NotificationPreferencesScreen.js`
- `src/screens/PaymentScreens/PaymentHistoryScreen.js`
- `src/screens/PaymentScreens/BillingAnalyticsScreen.js` (may or may not exist — skip if absent)
- `src/screens/SuggestFeatureScreen.js`
- `src/screens/PaymentScreens/ManageBillingScreen.js`
- `src/screens/PaymentScreens/DataHandlingFeeScreen.js`
- `src/screens/CreateOrganizationScreen.js`
- `src/screens/PricingScreen.js`
- `src/screens/AuthScreens/ForgotPasswordPage.js`
- `src/screens/AuthScreens/RegisterScreen.tsx` (re-exports `Register/RegisterScreen.tsx` — edit the real file)
- `src/screens/AuthScreens/VerifyEmail/VerifyEmailScreen.tsx`

- [ ] **Step 1: For each file**

Replace the outermost `<SafeAreaView>` (or `<View>` if that's what the screen uses) with `<ScreenScaffold edges={[]}>`.

For screens with a sticky bottom CTA (e.g. `CreateReport` has a Submit button pinned to the bottom — see commit `e5c03a3 fix(reports): pad Submit Report button above OS nav bar`), preserve any explicit bottom-inset handling on that button. The button needs `paddingBottom: useSafeAreaInsets().bottom + designMargin` inside the screen because the keyboard avoider / footer is below the safe area.

If a screen's outermost element is a plain `<View>` with `flex: 1`, simply wrap it: `<ScreenScaffold edges={[]}><View ...>...</View></ScreenScaffold>` and drop the View's `flex: 1`/background style (`ScreenScaffold` provides those). Or, if the View only existed to be a safe-area container, delete it and let `ScreenScaffold` be the outer element.

- [ ] **Step 2: Verify each file**

Run: `npm test 2>&1 | tail -20`
Expected: No new failures.

- [ ] **Step 3: Commit**

```bash
git add src/screens/<each-edited-file>
git commit -m "refactor(screens): migrate header-shown screens to ScreenScaffold

Stack header provides the top inset on these screens; edges=[] avoids
double-padding."
```

---

### Task 11: Migrate Login screen (auth root)

`LoginScreen.tsx` is the auth-stack root. No header, no parent — needs `edges={['top']}`.

**Files:**
- Modify: `src/screens/AuthScreens/Login/LoginScreen.tsx`

- [ ] **Step 1: Replace root**

Open the file and find the outermost element of the rendered JSX. If it's `<SafeAreaView>` (from `react-native-safe-area-context`), swap to `<ScreenScaffold edges={['top']}>`. If it's a plain `<View>`, wrap with `<ScreenScaffold>`.

- [ ] **Step 2: Run tests**

Run: `npm test -- Login 2>&1 | tail -10`
Expected: No new failures.

- [ ] **Step 3: Commit**

```bash
git add src/screens/AuthScreens/Login/LoginScreen.tsx
git commit -m "refactor(login): migrate to ScreenScaffold edges=['top']"
```

---

### Task 12: Phase 2 sweep — confirm no `SafeAreaView` imports remain in screens

- [ ] **Step 1: Search for stragglers**

Run:
```bash
grep -rn "from 'react-native-safe-area-context'" src/screens/ | grep -v "ScreenScaffold" | head -20
```

Expected: ideally empty. If any screen file still imports `SafeAreaView` from `react-native-safe-area-context`, either:

- it was missed in the migration — migrate it using the same pattern, or
- it legitimately needs the raw `SafeAreaView` (e.g. for `edges={['bottom']}` inside a sub-tree, not as the screen root). In that case, leave it.

`MainTabNavigator.tsx` is allowed to keep its `SafeAreaView` import — it's the tab root, not a screen.

- [ ] **Step 2: Commit any remaining migrations**

If you found and fixed stragglers, commit them:

```bash
git add <files>
git commit -m "refactor(screens): finish ScreenScaffold migration sweep"
```

---

## Phase 3 — Tools List Visual Overhaul

### Task 13: Extend `ToolItem` shape in `useMyTools`

**Files:**
- Modify: `src/screens/Tools/hooks/useMyTools.ts`

- [ ] **Step 1: Extend the `ToolItem` interface**

Find lines 8–13:

```ts
export interface ToolItem {
  id: string;
  identifier: string;
  toolType?: string;
  status: 'assigned' | 'available' | 'missing' | 'maintenance';
}
```

Replace with:

```ts
export interface ToolItem {
  id: string;
  identifier: string;
  toolType?: string;
  /** Human-readable site/van/toolbox name where the tool currently lives. */
  siteName?: string;
  /** Human-readable name of the user the tool is assigned to, if any. */
  assigneeName?: string;
  status: 'assigned' | 'available' | 'missing' | 'maintenance';
}
```

- [ ] **Step 2: Fix `groupMine` — stop overloading `toolType`**

Find lines 42–58:

```ts
function groupMine(assignments: AssignmentRead[]): SiteGroup[] {
  if (assignments.length === 0) return [];
  const tools: ToolItem[] = assignments.map((a) => ({
    id: String(a.tool_id),
    identifier: a.tool_name,
    toolType: a.assignee_site_name || undefined,
    status: 'assigned',
  }));
  return [
    {
      siteId: MINE_GROUP_ID,
      siteName: 'Assigned to you',
      siteType: 'toolbox',
      tools,
    },
  ];
}
```

Replace with:

```ts
function groupMine(assignments: AssignmentRead[]): SiteGroup[] {
  if (assignments.length === 0) return [];
  const tools: ToolItem[] = assignments.map((a) => ({
    id: String(a.tool_id),
    identifier: a.tool_name,
    // toolType stays empty for now — AssignmentRead doesn't surface the
    // tool's category. The third info line uses siteName instead.
    siteName: a.assignee_site_name || undefined,
    status: 'assigned',
  }));
  return [
    {
      siteId: MINE_GROUP_ID,
      siteName: 'Assigned to you',
      siteType: 'toolbox',
      tools,
    },
  ];
}
```

- [ ] **Step 3: `groupAll` is fine as-is**

`groupAll` already sets `toolType` from `t.category_name || [t.make, t.model]...`. Leave it. `assigneeName` / `siteName` stay `undefined` since the `ToolRead` API doesn't surface current assignment info.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p . 2>&1 | grep "useMyTools\|ToolsListItem" | head -10`
Expected: No output.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Tools/hooks/useMyTools.ts
git commit -m "refactor(tools-hook): split siteName/assigneeName from toolType

Previously toolType in 'mine' view was overloaded to carry the site name.
Make the shape explicit so ToolsListItem can render distinct lines for
category vs. site vs. assignee."
```

---

### Task 14: Redesign `ToolsListItem`

**Files:**
- Modify: `src/screens/Tools/components/ToolsListItem.tsx` (full rewrite)

- [ ] **Step 1: Replace the file**

```tsx
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import type { ToolItem } from '../hooks/useMyTools';

interface Props {
  item: ToolItem;
  onPress: (item: ToolItem) => void;
}

const STATUS_COLOR: Record<ToolItem['status'], 'primary' | 'success' | 'error' | 'warning'> = {
  assigned: 'primary',
  available: 'success',
  missing: 'error',
  maintenance: 'warning',
};

const ToolsListItem: React.FC<Props> = ({ item, onPress }) => {
  const { colors } = useTheme();
  const chipColor = colors[STATUS_COLOR[item.status]];

  // Third line: assignee takes precedence, then site, otherwise hidden.
  const contextLine = item.assigneeName
    ? `Assigned to ${item.assigneeName}`
    : item.siteName
    ? `At ${item.siteName}`
    : null;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.primary + '24' }]}>
        <Ionicons name="construct-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.identifier, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {item.identifier}
        </Text>
        {item.toolType ? (
          <Text
            style={[styles.type, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.toolType}
          </Text>
        ) : null}
        {contextLine ? (
          <Text
            style={[styles.context, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {contextLine}
          </Text>
        ) : null}
      </View>
      <View style={[styles.statusChip, { backgroundColor: chipColor + '2E', borderColor: chipColor }]}>
        <Text style={[styles.statusText, { color: chipColor }]}>{item.status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  identifier: { fontSize: 16, fontWeight: '600' },
  type: { fontSize: 13, marginTop: 2 },
  context: { fontSize: 12, marginTop: 2 },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  chevron: { marginLeft: 4 },
});

export default ToolsListItem;
```

- [ ] **Step 2: Run any existing tests**

Run: `npm test -- ToolsListItem 2>&1 | tail -10`
Expected: No new failures (file likely has no direct tests).

- [ ] **Step 3: Commit**

```bash
git add src/screens/Tools/components/ToolsListItem.tsx
git commit -m "feat(tools): redesign list row with icon, 3 info lines, bigger chip

Adds a leading icon circle, raises identifier text to 16/600, gives the
status chip more contrast (18% alpha bg) and bigger padding, and renders a
contextual third line for assignee or site location."
```

---

### Task 15: Redesign `SiteGroupHeader`

**Files:**
- Modify: `src/screens/Tools/components/SiteGroupHeader.tsx` (full rewrite)

- [ ] **Step 1: Replace the file**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import type { SiteGroup } from '../hooks/useMyTools';

const ICON: Record<SiteGroup['siteType'], 'location-outline' | 'bus-outline' | 'briefcase-outline'> = {
  location: 'location-outline',
  van: 'bus-outline',
  toolbox: 'briefcase-outline',
};

const SiteGroupHeader: React.FC<{ group: SiteGroup }> = ({ group }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.surfaceAlt,
          borderBottomColor: colors.borderLight,
        },
      ]}
    >
      <View style={styles.left}>
        <Ionicons name={ICON[group.siteType]} size={16} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textSecondary }]}>
          {group.siteName}
        </Text>
      </View>
      <View style={[styles.countPill, { backgroundColor: colors.card }]}>
        <Text style={[styles.countText, { color: colors.textPrimary }]}>
          {group.tools.length}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SiteGroupHeader;
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/Tools/components/SiteGroupHeader.tsx
git commit -m "feat(tools): restyle SiteGroupHeader as uppercase section label

Replaces emoji with Ionicons, makes the title an uppercase section label
with letter-spacing, and renders the tool count as a small pill instead of
inline text. Adds a hairline divider under the header."
```

---

### Task 16: Redesign `AdminToolsToggle`

**Files:**
- Modify: `src/screens/Tools/components/AdminToolsToggle.tsx` (full rewrite)

- [ ] **Step 1: Replace the file**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';

interface Props {
  value: 'mine' | 'all';
  onChange: (next: 'mine' | 'all') => void;
}

const AdminToolsToggle: React.FC<Props> = ({ value, onChange }) => {
  const { colors } = useTheme();
  const Option = (key: 'mine' | 'all', label: string) => {
    const active = value === key;
    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.opt,
          active && {
            backgroundColor: colors.primary,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowOffset: { width: 0, height: 1 },
                shadowRadius: 2,
              },
              android: { elevation: 2 },
            }),
          },
        ]}
        onPress={() => onChange(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text
          style={[
            styles.optText,
            { color: active ? (colors as any).onPrimary || '#fff' : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      {Option('mine', 'My Tools')}
      {Option('all', 'All Tools')}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
  },
  opt: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  optText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default AdminToolsToggle;
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/Tools/components/AdminToolsToggle.tsx
git commit -m "feat(tools): restyle AdminToolsToggle as segmented control

Borderless container, content-hugging options, active option uses primary
fill + subtle elevation. Matches the rest of the app's pill controls."
```

---

### Task 17: Add screen header bar to `ToolsScreen`

**Files:**
- Modify: `src/screens/Tools/ToolsScreen.tsx`

After Task 5, the file looks like the scaffolded version. Now add a top header row with title + admin toggle, restyle the empty state, and pad the list bottom.

- [ ] **Step 1: Replace the file**

```tsx
import React from 'react';
import { SectionList, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ScreenScaffold from '../../components/ScreenScaffold';
import { useMyTools, ToolItem } from './hooks/useMyTools';
import SiteGroupHeader from './components/SiteGroupHeader';
import ToolsListItem from './components/ToolsListItem';
import AdminToolsToggle from './components/AdminToolsToggle';

const ToolsScreen: React.FC = () => {
  const { userData } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const isAdminOrOwner = userData?.role === 'admin' || userData?.role === 'owner';
  const { isLoading, groups, filter, setFilter } = useMyTools(
    isAdminOrOwner ? 'all' : 'mine'
  );

  const sections = groups.map(g => ({ title: g.siteName, data: g.tools, group: g }));

  const handleToolPress = (t: ToolItem) => navigation.navigate('DeviceDetails', { deviceId: t.id });

  const HeaderRow = () => (
    <View style={[styles.headerRow, { borderBottomColor: colors.borderLight }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Tools</Text>
      {isAdminOrOwner ? (
        <AdminToolsToggle value={filter} onChange={setFilter} />
      ) : null}
    </View>
  );

  if (isLoading) {
    return (
      <ScreenScaffold edges={[]}>
        <HeaderRow />
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading tools…</Text>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold edges={[]}>
      <HeaderRow />
      <SectionList
        sections={sections as any}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => <SiteGroupHeader group={(section as any).group} />}
        renderItem={({ item }) => <ToolsListItem item={item} onPress={handleToolPress} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="construct-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No tools yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Tap the Scan button to check a tag, or ask an admin to add tools.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled
      />
    </ScreenScaffold>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '700' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 10, fontSize: 14 },
  empty: { paddingVertical: 64, paddingHorizontal: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  listContent: { paddingBottom: 24 },
});

export default ToolsScreen;
```

- [ ] **Step 2: Run tests**

Run: `npm test -- Tools 2>&1 | tail -10`
Expected: No new failures.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Tools/ToolsScreen.tsx
git commit -m "feat(tools): add screen header row + polished empty state

Title 'Tools' is now anchored at the top with the admin toggle inline. Empty
state gets an icon, title, and friendlier copy. List padded at the bottom
for visual rest above the tab bar."
```

---

## Final Verification

### Task 18: Manual smoke test on both platforms

- [ ] **Step 1: Start the app**

```bash
npm start -- --reset-cache
```

Open on Android (physical device or emulator with API 33+) and iOS.

- [ ] **Step 2: Walk the test matrix**

For each platform, verify:

1. **Tools tab**: title at top, admin toggle visible (if admin), rows are spacious with icon + 3 lines + chip + chevron, status chip is readable, section header is uppercase with count pill.
2. **Scan an unregistered NFC tag** (admin): "Tag not registered" screen with UID line. Tap "Add new device" → AddDevice form opens with the tag UID prefilled and shown in the existing pre-scanned tag banner. Submit creates a tool with `nfc_tag_id` set.
3. **Scan an unregistered NFC tag** (site worker): Same screen, "Ask an admin" message, Close button dismisses cleanly.
4. **Every screen** in the migration table: open it, confirm content does not collide with the status bar or sit under the bottom tab bar / gesture pill.
5. **Stack headers**: open `AddDevice`, `CreateReport`, `EditProfile` — header renders at native height, title is centered/anchored correctly, no visible double-padding above content.
6. **ReportDetails**: no phantom 40–60dp gap at the top of the screen.

- [ ] **Step 3: Run the full test suite**

```bash
npm run test:ci 2>&1 | tail -30
```

Expected: No new failures vs. master.

- [ ] **Step 4: If everything works, no further commit needed**

The earlier commits already captured the work. If manual testing finds an issue, fix it in a small follow-up commit.

---

## Notes for the implementer

- **Don't widen scope.** If you find an unrelated bug while editing a file, leave a TODO comment but don't fix it in this PR. We're shipping three focused changes.
- **Don't refactor screen contents** beyond replacing the safe-area wrapper. Many screens have stale patterns inside them (legacy API shapes, inline styles, ad-hoc state) — leave them as-is unless they actively conflict with the migration.
- **Theme keys assumed to exist** in `colors`: `background`, `card`, `border`, `borderLight`, `surface`, `surfaceAlt`, `primary`, `onPrimary`, `textPrimary`, `textSecondary`, `textMuted`, `success`, `warning`, `error`. Spot-checked against `src/context/ThemeContext.js` — all present.
- **No tests written here.** This repo's screen layer has thin unit-test coverage and these are pure visual/wiring changes. Where existing tests touch the modified files, they must continue to pass.
- **Frequent commits, small diffs.** Each task above lands as one commit.

