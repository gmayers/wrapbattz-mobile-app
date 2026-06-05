import { quickActionsForRole } from '../quickActions';

describe('quickActionsForRole', () => {
  it('returns 4 tiles for site_worker', () => {
    expect(quickActionsForRole('site_worker')).toHaveLength(4);
  });
  it('returns 4 tiles for office_worker', () => {
    expect(quickActionsForRole('office_worker')).toHaveLength(4);
  });
  it('returns 9 tiles for admin', () => {
    expect(quickActionsForRole('admin')).toHaveLength(9);
  });
  it('returns 9 tiles for owner', () => {
    expect(quickActionsForRole('owner')).toHaveLength(9);
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
  it('Notifications (admin/owner-only) is hidden from workers', () => {
    expect(quickActionsForRole('site_worker').map(a => a.key)).not.toContain('notifications');
    expect(quickActionsForRole('admin').map(a => a.key)).toContain('notifications');
  });
  it('My Tools targets the Tools tab inside MainTabs', () => {
    const myTools = quickActionsForRole('site_worker').find(a => a.key === 'myTools');
    expect(myTools?.destination).toBe('MainTabs');
    expect(myTools?.params).toEqual({ screen: 'tools' });
  });
  it('"Who has it?" uses the scan flow (onPressType: scan)', () => {
    const whoHasIt = quickActionsForRole('site_worker').find(a => a.key === 'whoHasIt');
    expect(whoHasIt).toBeDefined();
    expect(whoHasIt?.onPressType).toBe('scan');
  });
});
