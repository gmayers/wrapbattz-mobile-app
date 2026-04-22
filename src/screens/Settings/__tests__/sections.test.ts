import { getSectionsForRole } from '../sections';

describe('getSectionsForRole', () => {
  it('returns Account, Preferences, Support, Logout for worker', () => {
    const keys = getSectionsForRole('site_worker').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'support', 'logout']);
  });

  it('returns all 6 sections for admin', () => {
    const keys = getSectionsForRole('admin').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'billing', 'support', 'logout']);
  });

  it('returns all 6 sections for owner', () => {
    const keys = getSectionsForRole('owner').map(s => s.key);
    expect(keys).toEqual(['account', 'preferences', 'organization', 'billing', 'support', 'logout']);
  });

  it('worker does not see Organization or Billing sections', () => {
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
