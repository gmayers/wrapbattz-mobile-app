import { quickActionsForRole } from '../quickActions';

describe('quickActionsForRole', () => {
  it('returns 4 tiles for site_worker', () => {
    expect(quickActionsForRole('site_worker')).toHaveLength(4);
  });
  it('returns 4 tiles for office_worker', () => {
    expect(quickActionsForRole('office_worker')).toHaveLength(4);
  });
  it('returns 8 tiles for admin', () => {
    expect(quickActionsForRole('admin')).toHaveLength(8);
  });
  it('returns 8 tiles for owner', () => {
    expect(quickActionsForRole('owner')).toHaveLength(8);
  });
  it('admin tiles contain Billing and Invite User', () => {
    const keys = quickActionsForRole('admin').map(a => a.key);
    expect(keys).toContain('billing');
    expect(keys).toContain('inviteUser');
  });
  it('worker tiles do not contain Billing or Invite User', () => {
    const keys = quickActionsForRole('site_worker').map(a => a.key);
    expect(keys).not.toContain('billing');
    expect(keys).not.toContain('inviteUser');
  });
});
