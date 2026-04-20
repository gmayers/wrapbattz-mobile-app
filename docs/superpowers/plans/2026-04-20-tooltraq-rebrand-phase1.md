# TOOLTRAQ Rebrand — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the BattWrapz mobile app to TOOLTRAQ (name, bundle ID, in-app logo, yellow color palette, version reset to 1.0.0) and fix two user-reported bugs (Submit Report button clipped by OS nav bar, NFC "Writing..." button text misleading).

**Architecture:** This is entirely config / text / theme-token / asset work. No new services, screens, or contexts. The `Button` component gets one small default-text-color tweak. The `ThemeContext` gets a yellow primary and a new `onPrimary` token. Module-level `ORANGE_COLOR` constants across 7 screens get their hex values swapped in place — full theme-refactor is deferred to later work.

**Tech Stack:** React Native 0.81.5, Expo SDK 54, TypeScript (partial), Jest + React Testing Library for component tests.

**Spec:** `docs/superpowers/specs/2026-04-20-tooltraq-rebrand-phase1-design.md`

**Branch:** `feature/tooltraq-rebrand` off `master`.

---

## Task 1: Worktree + branch setup

**Files:**
- No code changes yet — worktree scaffolding only.

- [ ] **Step 1: Verify starting state**

Run:
```bash
cd /home/garan/Documents/programming/live-projects/wrapbattz2/app/wrapbattz
git status --short
git log -1 --format="%h %s"
```

Expected: on `master`, HEAD is `docs: add TOOLTRAQ Phase 1 rebrand design spec` (commit `f8bddf1` or later). Working tree may have unrelated unstaged changes — **do not stage or commit them** as part of this plan.

- [ ] **Step 2: Create the feature branch directly on master checkout**

Implementation can be done on the main checkout (branch created locally, no worktree needed for this scope since no long-running builds block the tree).

Run:
```bash
git checkout -b feature/tooltraq-rebrand
git status -sb
```

Expected: `## feature/tooltraq-rebrand` on the first line.

- [ ] **Step 3: No commit yet** — branch is created, proceed to Task 2.

---

## Task 2: Bug A — Submit Report button no longer clipped

**Files:**
- Modify: `src/screens/CreateReportScreen.js`

The screen renders via a `ScrollView` with its content containing the Submit button at the bottom. It's covered by the Android 3-button nav bar / iOS home indicator because no bottom padding compensates for the OS safe area. `CreateReport` is pushed on top of `MainTabs`, so tab-bar height is not the issue — only the OS system-nav inset matters.

- [ ] **Step 1: Read the file head to confirm imports**

Run (via Read tool):
```
Read src/screens/CreateReportScreen.js, lines 1-30
```

Expected: imports include `ScrollView` from `'react-native'`. **`useSafeAreaInsets` is NOT currently imported** — we'll need to add it.

- [ ] **Step 2: Add the import**

Edit `src/screens/CreateReportScreen.js` — add after the last `react-native` import (line 13 in the file as currently checked in):

```js
import { useSafeAreaInsets } from 'react-native-safe-area-context';
```

The project already uses this hook in `TabNavigation.js` and elsewhere, so the package is in `package.json` — no install needed.

- [ ] **Step 3: Grab the inset inside the component**

Locate the line:
```js
const { colors } = useTheme();
```
(it is at roughly line 45 in the file).

Add immediately below it:

```js
const insets = useSafeAreaInsets();
```

- [ ] **Step 4: Add `contentContainerStyle` to the ScrollView**

In `CreateReportScreen.js`, line 625, find this ScrollView:

```jsx
<ScrollView style={[styles.formContainer, { backgroundColor: colors.surface }]}>
```

Replace with:

```jsx
<ScrollView
  style={[styles.formContainer, { backgroundColor: colors.surface }]}
  contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
>
```

The ScrollView already uses the `style` prop (for background). We add a separate `contentContainerStyle` prop for the bottom padding — these two props are distinct in React Native (`style` applies to the ScrollView wrapper, `contentContainerStyle` applies to the inner content view).

- [ ] **Step 5: Smoke-check the Jest suite hasn't regressed**

Run:
```bash
npm test -- --testPathPattern=CreateReport 2>&1 | tail -20
```

Expected: either no tests match (zero tests for CreateReportScreen exist today — acceptable) or all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/CreateReportScreen.js
git commit -m "fix(reports): pad Submit Report button above OS nav bar"
```

---

## Task 3: Bug B — NFC "Writing..." wording in AddDeviceScreen

**Files:**
- Modify: `src/screens/AddDeviceScreen.js:1104`

- [ ] **Step 1: Make the text swap**

Edit `src/screens/AddDeviceScreen.js`, line ~1104:

Before:
```js
title={isWritingNfc ? 'Writing...' : 'Write Data to Tag'}
```

After:
```js
title={isWritingNfc ? 'Hold tag to device…' : 'Write Data to Tag'}
```

- [ ] **Step 2: Verify no other occurrences of the old string remain in this file**

Run (via Grep tool):
```
Grep pattern: 'Writing...'   path: src/screens/AddDeviceScreen.js
```

Expected: zero matches.

- [ ] **Step 3: Run relevant tests**

```bash
npm test -- --testPathPattern=AddDevice 2>&1 | tail -10
```

Expected: no AddDevice-specific tests exist (or all pass).

- [ ] **Step 4: Commit**

```bash
git add src/screens/AddDeviceScreen.js
git commit -m "fix(nfc): clarify write button prompts user to hold tag"
```

---

## Task 4: Bug B — NFC wording in QuickActionModal and NFCTabs

**Files:**
- Modify: `src/screens/QuickAction/QuickActionModalScreen.tsx:349`
- Modify: `src/screens/home/components/NFCManager/NFCTabs.js:132, 159, 183`

- [ ] **Step 1: QuickActionModalScreen — update the upgrade button**

Edit `src/screens/QuickAction/QuickActionModalScreen.tsx`, line ~349:

Before:
```tsx
title={upgrading ? 'Upgrading…' : 'Upgrade NFC tag'}
```

After:
```tsx
title={upgrading ? 'Hold tag to device…' : 'Upgrade NFC tag'}
```

- [ ] **Step 2: NFCTabs — write button**

Edit `src/screens/home/components/NFCManager/NFCTabs.js`, line ~132:

Before:
```js
title={isProcessing ? "Writing..." : "Write to Tag"}
```

After:
```js
title={isProcessing ? "Hold tag to device…" : "Write to Tag"}
```

- [ ] **Step 3: NFCTabs — lock button**

Edit line ~159:

Before:
```js
title={isProcessing ? "Locking..." : "Lock Tag"}
```

After:
```js
title={isProcessing ? "Hold tag to device…" : "Lock Tag"}
```

- [ ] **Step 4: NFCTabs — unlock button**

Edit line ~183:

Before:
```js
title={isProcessing ? "Unlocking..." : "Unlock Tag"}
```

After:
```js
title={isProcessing ? "Hold tag to device…" : "Unlock Tag"}
```

- [ ] **Step 5: Confirm all NFC "…ing" strings are gone**

Run (via Grep tool):
```
Grep pattern: "Writing\.\.\.|Locking\.\.\.|Unlocking\.\.\.|Formatting\.\.\.|Upgrading"   path: src/screens
```

Expected: zero matches.

- [ ] **Step 6: Run tests**

```bash
npm test -- --testPathPattern="NFC|QuickAction" 2>&1 | tail -20
```

Expected: NFCService unit tests still pass. No QuickAction tests exist.

- [ ] **Step 7: Commit**

```bash
git add src/screens/QuickAction/QuickActionModalScreen.tsx src/screens/home/components/NFCManager/NFCTabs.js
git commit -m "fix(nfc): unify NFC prompts to 'Hold tag to device…'"
```

---

## Task 5: Copy new logo asset into `assets/`

**Files:**
- Create: `assets/logo-tooltraq.png`
- Delete (after copy): `7a13a155-2c96-4a52-8a8d-a4e7f216447d.png` (project-root temp file)

- [ ] **Step 1: Verify source file exists**

Run:
```bash
ls -la 7a13a155-2c96-4a52-8a8d-a4e7f216447d.png
file 7a13a155-2c96-4a52-8a8d-a4e7f216447d.png
```

Expected: `PNG image data, 7912 x 2473, 8-bit/color RGBA`.

- [ ] **Step 2: Copy to assets/ with the canonical name**

Run:
```bash
cp 7a13a155-2c96-4a52-8a8d-a4e7f216447d.png assets/logo-tooltraq.png
ls -la assets/logo-tooltraq.png
```

Expected: file exists at `assets/logo-tooltraq.png` with the same size as the source.

- [ ] **Step 3: Remove the project-root temp**

Run:
```bash
rm 7a13a155-2c96-4a52-8a8d-a4e7f216447d.png
```

- [ ] **Step 4: Commit**

```bash
git add assets/logo-tooltraq.png
git commit -m "assets: add TOOLTRAQ logo (transparent PNG)"
```

---

## Task 6: Swap logo + remove "BATT WRAPZ" wordmark in auth screens

**Files:**
- Modify: `src/screens/AuthScreens/Login/LoginScreen.tsx`
- Modify: `src/screens/AuthScreens/Register/RegisterScreen.tsx`
- Modify: `src/screens/AuthScreens/ForgotPasswordPage.js`

- [ ] **Step 1: LoginScreen — swap logo image source**

Edit `src/screens/AuthScreens/Login/LoginScreen.tsx`, line ~135:

Before:
```tsx
<Image
  source={require('../../../../assets/logo-transparent.png')}
  style={{ width: 120, height: 120, alignSelf: 'center' }}
  resizeMode="contain"
/>
```

After (wider container because the new logo is 3.2:1):
```tsx
<Image
  source={require('../../../../assets/logo-tooltraq.png')}
  style={{ width: 260, height: 82, alignSelf: 'center' }}
  resizeMode="contain"
/>
```

(Width 260 × height 82 preserves the ~3.17 aspect ratio while fitting a typical portrait phone screen with 20px horizontal padding.)

- [ ] **Step 2: LoginScreen — remove the now-redundant "BATT WRAPZ" wordmark**

In the same file, line ~139, delete the entire line:

```tsx
<Text style={{ fontFamily: fonts.heading, fontSize: 28, color: colors.primary, textAlign: 'center' }}>BATT WRAPZ</Text>
```

The new logo contains the wordmark, so this separate `<Text>` is redundant and stale.

If the removal leaves `fonts` unused in the file, also remove its destructured import from `useTheme()` — but only if Grep confirms `fonts` is not used anywhere else in the file first.

- [ ] **Step 3: RegisterScreen — swap logo image source**

Edit `src/screens/AuthScreens/Register/RegisterScreen.tsx`, line ~201:

Before:
```tsx
source={require('../../../../assets/logo-transparent.png')}
```

After:
```tsx
source={require('../../../../assets/logo-tooltraq.png')}
```

Also adjust the `style` on the same `Image` to match the wider aspect ratio — find the surrounding `style={{...}}` and set `width: 260, height: 82` (replace whatever width/height are there). Preserve `alignSelf` and `resizeMode="contain"`.

- [ ] **Step 4: ForgotPasswordPage — swap logo image source**

Edit `src/screens/AuthScreens/ForgotPasswordPage.js`, line ~112:

Before:
```js
source={require('../../../assets/logo-transparent.png')}
```

After:
```js
source={require('../../../assets/logo-tooltraq.png')}
```

Same style update: `width: 260, height: 82` on the `Image`.

- [ ] **Step 5: Confirm no stale references remain**

Run (via Grep tool):
```
Grep pattern: logo-transparent\.png   path: src
```

Expected: zero matches. (We leave `assets/logo-transparent.png` itself on disk for now — unused but removable later.)

- [ ] **Step 6: Test**

```bash
npm test -- --testPathPattern="LoginScreen|RegisterScreen|ForgotPassword" 2>&1 | tail -20
```

Expected: all existing tests pass. (If LoginScreen tests assert the "BATT WRAPZ" text is present, update or remove that assertion.)

- [ ] **Step 7: Commit**

```bash
git add src/screens/AuthScreens/Login/LoginScreen.tsx \
        src/screens/AuthScreens/Register/RegisterScreen.tsx \
        src/screens/AuthScreens/ForgotPasswordPage.js
git commit -m "feat(brand): swap auth-screen logo to TOOLTRAQ, drop BATT WRAPZ wordmark"
```

---

## Task 7: Theme palette — swap orange → yellow and add `onPrimary`

**Files:**
- Modify: `src/context/ThemeContext.js`

- [ ] **Step 1: Edit `lightTheme` block**

Edit `src/context/ThemeContext.js`, lines 12-15 (the current `lightTheme` primary block).

Before:
```js
const lightTheme = {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceAlt: '#F0F0F0',
  card: '#FFFFFF',
  primary: '#FF9500',
  primaryDark: '#FF8C00',
  primaryLight: '#FFF3E0',
  primaryTint10: 'rgba(255, 149, 0, 0.1)',
  primaryTint6: 'rgba(255, 149, 0, 0.06)',
  primaryTint5: 'rgba(255, 149, 0, 0.05)',
```

After:
```js
const lightTheme = {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceAlt: '#F0F0F0',
  card: '#FFFFFF',
  primary: '#FFC72C',
  primaryDark: '#E5AE18',
  primaryLight: '#FFF4D1',
  primaryTint10: 'rgba(255, 199, 44, 0.10)',
  primaryTint6: 'rgba(255, 199, 44, 0.06)',
  primaryTint5: 'rgba(255, 199, 44, 0.05)',
  onPrimary: '#0F1722',
```

- [ ] **Step 2: Edit `darkTheme` block**

Edit lines 54-59 (the current `darkTheme` primary block).

Before:
```js
  primary: '#FF7700',
  primaryDark: '#FF9500',
  primaryLight: '#3D2600',
  primaryTint10: 'rgba(255, 119, 0, 0.1)',
  primaryTint6: 'rgba(255, 119, 0, 0.06)',
  primaryTint5: 'rgba(255, 119, 0, 0.05)',
```

After:
```js
  primary: '#FFC72C',
  primaryDark: '#E5AE18',
  primaryLight: '#3D2F08',
  primaryTint10: 'rgba(255, 199, 44, 0.10)',
  primaryTint6: 'rgba(255, 199, 44, 0.06)',
  primaryTint5: 'rgba(255, 199, 44, 0.05)',
  onPrimary: '#0F1722',
```

- [ ] **Step 3: Confirm no stray orange hex codes remain in this file**

Run (via Grep tool):
```
Grep pattern: "#FF9500|#FF7700|#FF8C00|#FFF3E0|#3D2600"   path: src/context/ThemeContext.js
```

Expected: zero matches.

- [ ] **Step 4: Run the theme-related tests (if any) and full suite smoke test**

```bash
npm test -- --testPathPattern=Theme 2>&1 | tail -10
```

Expected: either no matches or pass.

```bash
npm test 2>&1 | tail -30
```

Expected: full suite runs; any failures that existed before still exist, no new failures introduced.

- [ ] **Step 5: Commit**

```bash
git add src/context/ThemeContext.js
git commit -m "feat(brand): swap theme primary to TOOLTRAQ yellow #FFC72C, add onPrimary token"
```

---

## Task 8: `Button` component — use `onPrimary` as default text color on filled variant

**Files:**
- Modify: `src/components/Button.tsx:141-143`
- Modify: `src/tests/component/Button.test.tsx` (add one regression test)

The current `Button.tsx` returns `colors.textPrimary` as the default text color for the filled variant (line 142). On dark mode, `textPrimary` is `#FFFFFF`, which becomes white text on a yellow button — unreadable. We want the filled variant to use the new `onPrimary` token instead.

- [ ] **Step 1: Write the failing test**

Edit `src/tests/component/Button.test.tsx`. Add a new `describe` block at the end of the top-level `describe('Button Component', () => { ... })`, immediately before the closing `});`:

```tsx
describe('onPrimary Default Text Color', () => {
  it('filled variant uses theme onPrimary as default text color', () => {
    render(<Button {...defaultProps} variant="filled" />);
    const textElement = screen.getByText('Test Button');
    // Default theme here is light theme → onPrimary is #0F1722
    expect(textElement.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: '#0F1722' }),
      ])
    );
  });

  it('outlined variant keeps primary (yellow) as text color — unchanged', () => {
    render(<Button {...defaultProps} variant="outlined" />);
    const textElement = screen.getByText('Test Button');
    expect(textElement.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: '#FFC72C' }),
      ])
    );
  });

  it('textColorProp override still wins over onPrimary default', () => {
    render(<Button {...defaultProps} variant="filled" textColorProp="#123456" />);
    const textElement = screen.getByText('Test Button');
    expect(textElement.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: '#123456' }),
      ])
    );
  });
});
```

- [ ] **Step 2: Run the new tests — they should fail**

```bash
npm test -- --testPathPattern="Button.test" 2>&1 | tail -40
```

Expected: the three new tests fail because `getTextColor()` still returns `colors.textPrimary` for filled variant, not `onPrimary`. The other Button tests continue to pass.

- [ ] **Step 3: Update `Button.tsx` to use `onPrimary`**

Edit `src/components/Button.tsx`, the `getTextColor` function (lines 134-144):

Before:
```tsx
  const getTextColor = (): string => {
    if (textColorProp) return textColorProp;
    if (disabled) return colors.textSecondary;
    switch (variant) {
      case 'outlined':
      case 'ghost':
        return colors.primary;
      default: // 'filled'
        return colors.textPrimary;
    }
  };
```

After:
```tsx
  const getTextColor = (): string => {
    if (textColorProp) return textColorProp;
    if (disabled) return colors.textSecondary;
    switch (variant) {
      case 'outlined':
      case 'ghost':
        return colors.primary;
      default: // 'filled'
        return (colors as any).onPrimary ?? colors.textPrimary;
    }
  };
```

The `?? colors.textPrimary` fallback protects against any future theme variants that forget `onPrimary`. The `as any` is a deliberate TypeScript escape hatch because `ThemeContext.js` is untyped JS — a cleaner typed `Colors` interface is out of scope for Phase 1.

- [ ] **Step 4: Run tests — they should pass**

```bash
npm test -- --testPathPattern="Button.test" 2>&1 | tail -30
```

Expected: all Button tests pass, including the three new `onPrimary Default Text Color` tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/Button.tsx src/tests/component/Button.test.tsx
git commit -m "feat(button): use onPrimary token for filled variant default text color"
```

---

## Task 9: Purge legacy orange hex values from hardcoded constants

**Files:**
- Modify: `src/utils/CommonUtils.js:7`
- Modify: `src/screens/AllReportsScreen.js:26`
- Modify: `src/screens/PaymentScreens/BillingAnalyticsScreen.js:19`
- Modify: `src/screens/PaymentScreens/ManageBillingScreen.js:21`
- Modify: `src/screens/PaymentScreens/NotificationPreferencesScreen.js:21`
- Modify: `src/screens/PaymentScreens/DataHandlingFeeScreen.js:20`
- Modify: `src/screens/PaymentScreens/PaymentHistoryScreen.js:19`
- Modify: `src/screens/LocationsScreen.js:31`
- Modify: `src/services/NotificationService.ts:79`

Every one of these files defines its own orange constant with the same value. Phase 1 swaps the value in place; a Phase 2+ cleanup can consolidate them onto `useTheme().colors.primary`.

- [ ] **Step 1: `CommonUtils.js` — swap `PRIMARY_ORANGE`**

Edit `src/utils/CommonUtils.js`, line 7:

Before:
```js
  PRIMARY_ORANGE: '#FF9500',
```

After:
```js
  PRIMARY_ORANGE: '#FFC72C',
```

(Rename of the key itself is deferred to avoid churn — callers just read the new hex.)

- [ ] **Step 2: Swap `ORANGE_COLOR` constants (7 files)**

For each file below, replace the single declaration line:
```js
const ORANGE_COLOR = '#FF9500';
```
with:
```js
const ORANGE_COLOR = '#FFC72C';
```

Files:
- `src/screens/AllReportsScreen.js:26`
- `src/screens/PaymentScreens/BillingAnalyticsScreen.js:19`
- `src/screens/PaymentScreens/ManageBillingScreen.js:21`
- `src/screens/PaymentScreens/NotificationPreferencesScreen.js:21`
- `src/screens/PaymentScreens/DataHandlingFeeScreen.js:20`
- `src/screens/PaymentScreens/PaymentHistoryScreen.js:19`
- `src/screens/LocationsScreen.js:31`

If a file has a trailing comment (e.g., `// Standard iOS orange`), replace with `// TOOLTRAQ yellow` or drop the comment.

- [ ] **Step 3: `NotificationService.ts` — Android notification channel color**

Edit `src/services/NotificationService.ts`, line 79:

Before:
```ts
      lightColor: '#FF9500',
```

After:
```ts
      lightColor: '#FFC72C',
```

- [ ] **Step 4: Verify no orange hex codes remain anywhere in `src/`**

Run (via Grep tool):
```
Grep pattern: "#FF9500|#FF7700|#FF8C00"   path: src
```

Expected: zero matches.

- [ ] **Step 5: Run the full test suite**

```bash
npm test 2>&1 | tail -30
```

Expected: same pass/fail counts as before Task 9 — no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/utils/CommonUtils.js \
        src/screens/AllReportsScreen.js \
        src/screens/PaymentScreens/BillingAnalyticsScreen.js \
        src/screens/PaymentScreens/ManageBillingScreen.js \
        src/screens/PaymentScreens/NotificationPreferencesScreen.js \
        src/screens/PaymentScreens/DataHandlingFeeScreen.js \
        src/screens/PaymentScreens/PaymentHistoryScreen.js \
        src/screens/LocationsScreen.js \
        src/services/NotificationService.ts
git commit -m "feat(brand): swap legacy ORANGE_COLOR constants to TOOLTRAQ yellow"
```

---

## Task 10: Audit and fix `textColorProp="white"` on yellow buttons

**Files:**
- Modify: `src/screens/AddDeviceScreen.js` (lines 1114, 1130, 1140, 1146, 1181)

Other `textColor="white"` occurrences (in `NFCTestComponent.tsx`, `SelectMenuTab.js`, `AssignDeviceModal.js`, `NFCScanTab.js`, `LockTab.js`, `UnlockTab.js`) use the **prop name `textColor`** which the `Button` component does NOT read (only `textColorProp`). Those are no-ops today — the default `onPrimary` kicks in automatically once Task 8 lands. **Leave those alone** — changing them to `textColorProp` would alter behavior, which is out of scope.

- [ ] **Step 1: AddDeviceScreen — remove explicit white overrides**

Edit `src/screens/AddDeviceScreen.js`. For each of the 5 occurrences of `textColorProp="white"` (approximately lines 1114, 1130, 1140, 1146, 1181), **delete the line entirely**. The default text color from Task 8 (`onPrimary` = `#0F1722`) is correct for these buttons.

Use a simple targeted approach: read the file around each line, remove the single line that contains `textColorProp="white"`.

- [ ] **Step 2: Verify zero `textColorProp="white"` occurrences remain**

Run (via Grep tool):
```
Grep pattern: 'textColorProp="white"'   path: src
```

Expected: zero matches.

- [ ] **Step 3: Confirm `textColor="white"` occurrences are untouched**

Run (via Grep tool):
```
Grep pattern: 'textColor="white"'   path: src
```

Expected: same 8 occurrences as before (unchanged — they were no-ops, still no-ops).

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern="AddDevice|Button" 2>&1 | tail -20
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/AddDeviceScreen.js
git commit -m "fix(button): drop white text overrides on yellow buttons"
```

---

## Task 11: `app.json` rebrand (code-only fields)

**Files:**
- Modify: `app.json`

This task covers the *code-checkable* fields only. The EAS-generated fields (`expo.updates.url`, `expo.extra.eas.projectId`) require running `eas init` on your Expo account — flagged in Task 13 as a manual out-of-band step.

- [ ] **Step 1: Update identity fields**

Edit `app.json`. Apply this diff (line numbers are approximate — look for the keys):

```diff
   "expo": {
-    "name": "battwrapz",
-    "slug": "battwrapz",
+    "name": "TOOLTRAQ",
+    "slug": "tooltraq",
     "owner": "garanmayers7262",
-    "version": "1.9.5",
+    "version": "1.0.0",
```

- [ ] **Step 2: Update scheme**

```diff
-    "scheme": "wrapbattz",
+    "scheme": "tooltraq",
```

- [ ] **Step 3: Update iOS bundle identifier and URL scheme**

```diff
     "ios": {
       ...
       "infoPlist": {
         "CFBundleURLTypes": [
           {
             "CFBundleURLSchemes": [
-              "wrapbattz"
+              "tooltraq"
             ]
           }
         ],
         ...
       },
       ...
-      "bundleIdentifier": "com.garanmayers7262.battwrapz",
+      "bundleIdentifier": "com.garanmayers7262.tooltraq",
```

- [ ] **Step 4: Update Android package**

```diff
     "android": {
       ...
-      "package": "com.garanmayers7262.battwrapz",
+      "package": "com.garanmayers7262.tooltraq",
```

- [ ] **Step 5: DO NOT CHANGE these fields**

Confirm these remain as-is:
- `"associatedDomains": ["applinks:webportal.battwrapz.com"]`
- Android `intentFilters[0].data[0].host: "webportal.battwrapz.com"`
- Sentry `"project": "battwrapz"`
- `"expo.updates.url"` and `"expo.extra.eas.projectId"` — these get regenerated by `eas init` in Task 13.

- [ ] **Step 6: Validate JSON syntax**

Run:
```bash
node -e "require('./app.json'); console.log('OK')"
```

Expected: prints `OK`. If parse error, fix the JSON.

- [ ] **Step 7: Commit**

```bash
git add app.json
git commit -m "chore(brand): rebrand app.json to TOOLTRAQ identity (name, slug, bundle IDs, scheme, version reset)"
```

---

## Task 12: Deep-link scheme in `src/navigation/index.js`

**Files:**
- Modify: `src/navigation/index.js:36-47`

- [ ] **Step 1: Add `tooltraq://` to the linking prefixes**

Edit `src/navigation/index.js`, the `linking` const (lines 36-47):

Before:
```js
const linking = {
  prefixes: [
    'https://webportal.battwrapz.com',
    'wrapbattz://',
  ],
  config: {
    screens: {
      QuickActionModal: 'd/:tagUID',
    },
  },
};
```

After:
```js
const linking = {
  prefixes: [
    'https://webportal.battwrapz.com',
    'tooltraq://',
    'wrapbattz://', // legacy fallback — remove in a later cleanup pass
  ],
  config: {
    screens: {
      QuickActionModal: 'd/:tagUID',
    },
  },
};
```

- [ ] **Step 2: Test**

```bash
npm test 2>&1 | tail -20
```

Expected: full suite passes at the same rate as before.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/index.js
git commit -m "feat(linking): register tooltraq:// scheme alongside wrapbattz:// fallback"
```

---

## Task 13: Manual out-of-band — `eas init` + credentials (user runs)

**Files:** none changed by agent; user runs commands locally.

This task cannot be done by the implementation agent because it requires the user's Expo credentials. The plan documents it so the user knows exactly what to run.

- [ ] **Step 1: User runs `eas init` on the feature branch**

```bash
# User runs:
eas init
```

Expected: EAS CLI prompts for confirmation; produces a new `projectId` and updates `app.json` in place — `expo.updates.url` and `expo.extra.eas.projectId` get new values.

- [ ] **Step 2: User runs `eas credentials` for iOS and Android**

```bash
eas credentials -p ios
eas credentials -p android
```

Follow the interactive prompts to register the new bundle ID with App Store Connect / Play Console.

- [ ] **Step 3: User commits the updated app.json**

```bash
git add app.json
git commit -m "chore(eas): new EAS project for tooltraq bundle"
```

- [ ] **Step 4: Confirm in plan that Task 13 is done** — no agent action needed, just mark the checkbox once the user confirms they've done this.

---

## Task 14: Final verification — manual acceptance

**Files:** none. Run-only.

Run on a physical device (NFC requires real hardware) **before** merging the branch. The spec's acceptance criteria:

- [ ] **Step 1: Run the full Jest suite**

```bash
npm test 2>&1 | tail -40
```

Expected: pass at the same rate as the pre-branch baseline. No new failures introduced by the rebrand.

- [ ] **Step 2: Build a development client**

```bash
eas build --platform ios --profile development
# and/or
eas build --platform android --profile development
```

Install on a physical device.

- [ ] **Step 3: On-device acceptance checklist**

Tick each as you verify:

- [ ] App icon shown on home screen (still old BattWrapz icon — expected for Phase 1)
- [ ] Splash screen shown on launch (still old — expected)
- [ ] Log in: TOOLTRAQ logo visible and legible on Login screen
- [ ] TOOLTRAQ logo visible and legible on Register screen
- [ ] TOOLTRAQ logo visible and legible on Forgot Password screen
- [ ] Login screen does NOT show the old "BATT WRAPZ" text below the logo
- [ ] Light mode: yellow buttons with dark text are readable
- [ ] Dark mode: yellow buttons with dark text are readable (matches mockup)
- [ ] No orange UI elements anywhere (report screens, billing screens, payment screens, location screens, profile)
- [ ] Create Report screen — Submit Report button fully visible above the system nav / home indicator, not clipped
- [ ] Add Device screen — tap "Write Data to Tag" — button label changes to **"Hold tag to device…"** (not "Writing...")
- [ ] NFC Manager modal — Write / Lock / Unlock buttons all show **"Hold tag to device…"** while processing
- [ ] QuickActionModal — Upgrade NFC tag button shows **"Hold tag to device…"** while upgrading
- [ ] Deep-link `tooltraq://d/<fake-uid>` opens QuickActionModal
- [ ] Deep-link `https://webportal.battwrapz.com/d/<fake-uid>` still opens QuickActionModal (no backend regression)

- [ ] **Step 4: If any check fails** — fix in a new commit on the branch before opening the PR. Do not amend prior commits.

---

## Task 15: Open PR

**Files:** none. GitHub action.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/tooltraq-rebrand
```

- [ ] **Step 2: Open PR using `gh`**

```bash
gh pr create --title "TOOLTRAQ rebrand + bug fixes (Phase 1)" --body "$(cat <<'EOF'
## Summary
- Rebrand to TOOLTRAQ: new name, slug, bundle IDs, color palette (yellow #FFC72C), in-app logo, version reset to 1.0.0
- Fix Submit Report button clipped by OS nav bar
- Fix NFC "Writing..." wording → "Hold tag to device…"

Spec: `docs/superpowers/specs/2026-04-20-tooltraq-rebrand-phase1-design.md`
Plan: `docs/superpowers/plans/2026-04-20-tooltraq-rebrand-phase1.md`

## Out of scope (Phase 2)
- Role-based navigation restructure + center Scan button
- Square app icon / splash screen swap (pending square logo asset)
- Backend rename

## Test plan
- [ ] `npm test` passes at baseline rate
- [ ] Login/Register/Forgot screens show TOOLTRAQ logo on physical device
- [ ] Yellow buttons legible in both light and dark mode
- [ ] Submit Report button visible above OS nav on Android + iOS
- [ ] NFC write/lock/unlock/upgrade all prompt "Hold tag to device…"
- [ ] Deep links `tooltraq://d/<uid>` and `https://webportal.battwrapz.com/d/<uid>` both work

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Return the PR URL to the user.**

---

## Appendix — summary of commits produced by this plan

1. `fix(reports): pad Submit Report button above OS nav bar`
2. `fix(nfc): clarify write button prompts user to hold tag`
3. `fix(nfc): unify NFC prompts to 'Hold tag to device…'`
4. `assets: add TOOLTRAQ logo (transparent PNG)`
5. `feat(brand): swap auth-screen logo to TOOLTRAQ, drop BATT WRAPZ wordmark`
6. `feat(brand): swap theme primary to TOOLTRAQ yellow #FFC72C, add onPrimary token`
7. `feat(button): use onPrimary token for filled variant default text color`
8. `feat(brand): swap legacy ORANGE_COLOR constants to TOOLTRAQ yellow`
9. `fix(button): drop white text overrides on yellow buttons`
10. `chore(brand): rebrand app.json to TOOLTRAQ identity (name, slug, bundle IDs, scheme, version reset)`
11. `feat(linking): register tooltraq:// scheme alongside wrapbattz:// fallback`
12. `chore(eas): new EAS project for tooltraq bundle` (produced by user, not agent)
