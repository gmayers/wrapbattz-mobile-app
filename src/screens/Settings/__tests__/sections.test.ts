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

  it('returns all 6 sections for admin on Android (no billing)', () => {
    Platform.OS = 'android';
    const keys = getSectionsForRole('admin').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'support', 'logout']);
  });

  it('returns billing for owner on Android', () => {
    Platform.OS = 'android';
    const keys = getSectionsForRole('owner').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'billing', 'support', 'logout']);
  });

  it('shows Billing on iOS for owner (owner-only, not platform-gated)', () => {
    Platform.OS = 'ios';
    const keys = getSectionsForRole('owner').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'billing', 'support', 'logout']);
  });

  it('hides Billing on iOS for admin (owner-only)', () => {
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

const billingRows = (role: any) =>
  getSectionsForRole(role).find((s) => s.key === 'billing')?.rows.map((r) => r.key);

describe.each(['ios', 'android'])('billing section on %s', (os) => {
  beforeEach(() => {
    Platform.OS = os as any;
  });

  it('owner sees a single Subscription row', () => {
    expect(billingRows('owner')).toEqual(['subscription']);
  });

  it('admin and workers do not see billing', () => {
    expect(billingRows('admin')).toBeUndefined();
    expect(billingRows('site_worker')).toBeUndefined();
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
    // indexOf returns -1 for a missing key, and -1 < anything would pass
    // trivially even if a row were deleted — assert presence first.
    expect(keys).toContain('resetOnboarding');
    expect(keys).toContain('deleteAccount');
    expect(keys.indexOf('resetOnboarding')).toBeLessThan(keys.indexOf('deleteAccount'));
  });
});
