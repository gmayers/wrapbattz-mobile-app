import { Platform } from 'react-native';
import { getSectionsForRole } from '../sections';

const originalOS = Platform.OS;
afterEach(() => {
  Platform.OS = originalOS;
});

describe('getSectionsForRole', () => {
  it('returns Account, Preferences, Support, Logout for worker', () => {
    const keys = getSectionsForRole('site_worker').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'support', 'logout']);
  });

  it('returns all 6 sections for admin on Android', () => {
    Platform.OS = 'android';
    const keys = getSectionsForRole('admin').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'billing', 'support', 'logout']);
  });

  it('returns all 6 sections for owner on Android', () => {
    Platform.OS = 'android';
    const keys = getSectionsForRole('owner').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'billing', 'support', 'logout']);
  });

  it('hides Billing on iOS even for admin (App Store 3.1.3(c))', () => {
    Platform.OS = 'ios';
    const keys = getSectionsForRole('admin').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'support', 'logout']);
  });

  it('worker does not see Organization or Billing sections', () => {
    Platform.OS = 'android';
    const keys = getSectionsForRole('office_worker').map(s => s.key);
    expect(keys).not.toContain('organization');
    expect(keys).not.toContain('billing');
  });

  it('Logout section has exactly one destructive action row', () => {
    const logout = getSectionsForRole('admin').find(s => s.key === 'logout')!;
    expect(logout.rows).toHaveLength(1);
    expect(logout.rows[0].kind).toBe('action');
    expect(logout.rows[0].destructive).toBe(true);
  });
});

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
