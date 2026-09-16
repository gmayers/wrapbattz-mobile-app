# Reset Onboarding (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any user replay the onboarding wizard from mobile Settings, without touching organisation data.

**Architecture:** One new action row in the Account section of Settings. Its handler reads the user's first onboarding step from `GET /account/onboarding/` (the wizard is role-branched, so the first step is not a constant), PATCHes the three onboarding flags back via the existing `updateOnboarding`, and navigates to `OnboardingWizard`. No backend change of any kind.

**Tech Stack:** React Native 0.81 / Expo SDK 54, TypeScript, Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-08-13-account-deletion-and-reset-onboarding-design.md` (Part C).

**Scope:** Mobile only. Parts A and B of that spec are a separate backend plan. This plan depends on nothing in them and can ship first, as an OTA.

## Global Constraints

- Repo: the `wrapbattz` mobile app, primary working directory.
- Branch: work on `feat/perf-optimizations` (the current branch and the OTA source) unless told otherwise.
- Test command: `npx jest --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=/.worktrees/`
- **Baseline: 8 failing suites / 63 failing tests, all pre-existing** — `Button`, `FormField`, `PasswordField`, `AuthFlow` (e2e), `AuthFlow` (integration), `NFCService`, `NFCUtils`, `BillingService`. Do not try to fix them; your target is the same 8 and no others.
- **No backend change.** `PATCH /account/onboarding/` already accepts all three flags (`accounts/schemas.py:132-135` server-side). Do not add an endpoint, do not edit `docs/api/openapi.json`, do not run `npm run api:types`.
- The reset must touch **nothing shared**: no organisation data, no tools, no members, no demo data.
- Visible to every role — `requiredRole: 'all'` on the Account section, which already has that gate.
- Not destructive styling. It is a replay, not a deletion.

## File Structure

| File | Responsibility |
|---|---|
| `src/screens/Settings/sections.ts` | +`resetOnboarding` in the `onPressType` union and one row in the Account section |
| `src/screens/Settings/SettingsScreen.tsx` | The press handler: confirm → fetch first step → PATCH → navigate |
| `src/screens/Settings/__tests__/sections.test.ts` | Assert the row exists for every role |
| `src/screens/Settings/__tests__/SettingsScreen.resetOnboarding.test.tsx` | **New.** Behaviour of the handler |

---

### Task 1: The Settings row

**Files:**
- Modify: `src/screens/Settings/sections.ts` (the `onPressType` union at line 13; the Account section's `rows` at lines 30-34)
- Test: `src/screens/Settings/__tests__/sections.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a row with `key: 'resetOnboarding'` and `onPressType: 'resetOnboarding'`. Task 2's handler switches on that exact `onPressType` string.

- [ ] **Step 1: Write the failing test**

Append to `src/screens/Settings/__tests__/sections.test.ts`:

```ts
describe('Reset Onboarding row', () => {
  const findReset = (role: string) =>
    getSectionsForRole(role as any)
      .flatMap(s => s.rows)
      .find(r => r.key === 'resetOnboarding');

  it.each(['site_worker', 'office_worker', 'admin', 'owner'])(
    'is available to %s',
    (role) => {
      expect(findReset(role)).toBeDefined();
    },
  );

  it('lives in the Account section and is not styled destructive', () => {
    const account = getSectionsForRole('site_worker').find(s => s.key === 'account')!;
    const row = account.rows.find(r => r.key === 'resetOnboarding')!;
    expect(row).toBeDefined();
    expect(row.kind).toBe('action');
    expect(row.onPressType).toBe('resetOnboarding');
    // A replay is not a deletion — destructive styling would misrepresent it.
    expect(row.destructive).toBeFalsy();
  });

  it('sits above Delete Account so the destructive row stays last', () => {
    const account = getSectionsForRole('site_worker').find(s => s.key === 'account')!;
    const keys = account.rows.map(r => r.key);
    expect(keys.indexOf('resetOnboarding')).toBeLessThan(keys.indexOf('deleteAccount'));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/screens/Settings/__tests__/sections.test.ts`
Expected: FAIL — `expect(received).toBeDefined()` receives `undefined`, because no such row exists.

- [ ] **Step 3: Add the row**

In `src/screens/Settings/sections.ts`, extend the `onPressType` union (line 13) to include the new value:

```ts
  onPressType?: 'logout' | 'deleteAccount' | 'whatsNew' | 'addDemoData' | 'removeDemoData' | 'resetOnboarding';
```

Then add the row to the Account section, immediately **before** the `deleteAccount` row so the destructive one stays last:

```ts
      // Replays the setup wizard for this user only — no organisation data,
      // tools or members are touched. Backed by PATCH /account/onboarding/.
      { key: 'resetOnboarding', label: 'Reset Onboarding', icon: 'refresh-outline', kind: 'action', onPressType: 'resetOnboarding' },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/screens/Settings/__tests__/sections.test.ts`
Expected: PASS. The pre-existing `getSectionsForRole` tests assert section *keys*, not row counts, so they are unaffected — confirm they still pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Settings/sections.ts src/screens/Settings/__tests__/sections.test.ts
git commit -m "feat(settings): add a Reset Onboarding row

Replays the setup wizard for the calling user only. Sits above Delete
Account so the destructive row stays last, and is not styled destructive
itself — it is a replay, not a deletion."
```

---

### Task 2: The press handler

**Files:**
- Modify: `src/screens/Settings/SettingsScreen.tsx` (imports at lines 1-11; `handleRowPress` at line 20 onward)
- Test: `src/screens/Settings/__tests__/SettingsScreen.resetOnboarding.test.tsx` (new)

**Interfaces:**
- Consumes: the `onPressType: 'resetOnboarding'` row from Task 1.
- Produces: no exported symbol. Behaviour only.

Context you need about the existing file:
- It already imports `Alert` from `react-native`, `useNavigation` from `@react-navigation/native`, `useAuth` from `../../context/AuthContext`, and `organizations` from `../../api/endpoints`.
- `useAuth()` exposes `updateOnboarding(payload)` — see `src/auth/AuthContext.tsx:211`.
- `account.getOnboarding()` exists at `src/api/endpoints/account.ts:39` and returns an `OnboardingState`.
- The existing `addDemoData` handler (lines 29-46) is the pattern to follow for confirm-then-call-then-report.

**Why the first step is fetched rather than hardcoded:** the wizard is role-branched server-side (`accounts/onboarding_flow.py`), so an owner and a site worker do not start on the same step. Writing a constant would put some users on a step that is not in their flow.

- [ ] **Step 1: Write the failing test**

Create `src/screens/Settings/__tests__/SettingsScreen.resetOnboarding.test.tsx`:

```tsx
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';

const mockNavigate = jest.fn();
const mockUpdateOnboarding = jest.fn();
const mockGetOnboarding = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    userData: { role: 'site_worker' },
    logout: jest.fn(),
    deleteAccount: jest.fn(),
    updateOnboarding: mockUpdateOnboarding,
  }),
}));

jest.mock('../../../api/endpoints', () => ({
  organizations: { createDemoData: jest.fn(), deleteDemoData: jest.fn() },
  account: { getOnboarding: (...a: unknown[]) => mockGetOnboarding(...a) },
}));

/** Press the confirm button of the most recent Alert.alert call. */
const pressConfirm = async () => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)![2];
  const confirm = buttons.find((b: { text: string }) => b.text !== 'Cancel');
  await confirm.onPress();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGetOnboarding.mockResolvedValue({ steps: [{ key: 'welcome' }, { key: 'company' }] });
  mockUpdateOnboarding.mockResolvedValue({});
});

describe('Reset Onboarding', () => {
  it('confirms before doing anything', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockUpdateOnboarding).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('resets all three flags using the first step from the user flow', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() => expect(mockUpdateOnboarding).toHaveBeenCalledWith({
      has_completed_onboarding: false,
      has_seen_onboarding_outro: false,
      onboarding_step: 'welcome',
    }));
    expect(mockNavigate).toHaveBeenCalledWith('OnboardingWizard');
  });

  it('does not navigate when the reset fails', async () => {
    mockUpdateOnboarding.mockRejectedValue(new Error('network is down'));

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'network is down'),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('still resets when the flow lookup fails, without navigating blind', async () => {
    mockGetOnboarding.mockRejectedValue(new Error('offline'));

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'offline'));
    expect(mockUpdateOnboarding).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('touches no organisation data', async () => {
    const { organizations } = require('../../../api/endpoints');

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() => expect(mockUpdateOnboarding).toHaveBeenCalled());
    expect(organizations.createDemoData).not.toHaveBeenCalled();
    expect(organizations.deleteDemoData).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/screens/Settings/__tests__/SettingsScreen.resetOnboarding.test.tsx`
Expected: FAIL. The row renders (Task 1 added it) but pressing it does nothing, so `Alert.alert` is never called and `mockUpdateOnboarding` is never called.

If instead the whole suite errors on rendering `SettingsScreen`, a dependency of the screen is not mocked — read the failure, add the missing mock to the test file, and say so in your report. Do not change the screen to make it easier to render.

- [ ] **Step 3: Add the handler**

In `src/screens/Settings/SettingsScreen.tsx`, add `account` to the endpoints import:

```ts
import { account, organizations } from '../../api/endpoints';
```

Pull `updateOnboarding` out of `useAuth()`:

```ts
  const { userData, logout, deleteAccount, updateOnboarding } = useAuth();
```

Then add this branch to `handleRowPress`, immediately before the `deleteAccount` branch:

```tsx
    if (row.kind === 'action' && row.onPressType === 'resetOnboarding') {
      Alert.alert(
        'Reset Onboarding',
        'This replays the setup wizard for your account. Your organization, tools, sites and team members are not changed.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', onPress: async () => {
            try {
              // The wizard is role-branched server-side, so the first step is
              // not a constant — ask for this user's flow rather than guessing.
              const state = await account.getOnboarding();
              const firstStep = state?.steps?.[0]?.key;
              await updateOnboarding({
                has_completed_onboarding: false,
                has_seen_onboarding_outro: false,
                ...(firstStep ? { onboarding_step: firstStep } : {}),
              });
              navigation.navigate('OnboardingWizard');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to reset onboarding. Please try again.');
            }
          } },
        ],
        { cancelable: true }
      );
      return;
    }
```

Navigation happens only after the PATCH resolves, so a failed reset cannot drop the user into a wizard the server still considers complete.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/screens/Settings/__tests__/SettingsScreen.resetOnboarding.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full suite and confirm the baseline is unchanged**

Run: `npx jest --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=/.worktrees/`
Expected: the same **8 failing suites / 63 failing tests** as the baseline, plus your new tests passing. If a ninth suite fails, it is yours — fix it before committing.

Also run `npx tsc --noEmit` and confirm no new errors in `SettingsScreen.tsx` or `sections.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Settings/SettingsScreen.tsx src/screens/Settings/__tests__/SettingsScreen.resetOnboarding.test.tsx
git commit -m "feat(settings): wire up Reset Onboarding

Confirms, reads the caller's first onboarding step from the server
(the wizard is role-branched, so it is not a constant), resets the three
flags via the existing PATCH /account/onboarding/, then opens the wizard.
Navigation only happens after the PATCH resolves, so a failed reset cannot
strand the user in a wizard the server thinks is finished."
```

---

## After this plan

Ship as an OTA alongside whatever else is pending: bump `CHANGELOG_VERSION` and add an entry in `src/constants/changelog.ts` following the 1.4.8 pattern, then `eas update --branch production`. Production builds are runtime `1.0.0` and `app.json` is `1.0.0`, so the update reaches installed apps.

The backend plan for Parts A and B (`DELETE /account/` and the retention setting) is separate and independent. Note that mobile Settings already has a Delete Account row that calls an endpoint which does not exist yet — it 404s until that plan ships.
