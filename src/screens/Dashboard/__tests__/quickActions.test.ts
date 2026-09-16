import { quickActionsForRole } from '../quickActions';

describe('quickActionsForRole', () => {
  it('returns 5 tiles for site_worker', () => {
    expect(quickActionsForRole('site_worker')).toHaveLength(5);
  });
  it('returns 5 tiles for office_worker', () => {
    expect(quickActionsForRole('office_worker')).toHaveLength(5);
  });
  it('returns 9 tiles for admin (no billing)', () => {
    expect(quickActionsForRole('admin')).toHaveLength(9);
  });
  it('returns 10 tiles for owner (includes billing)', () => {
    expect(quickActionsForRole('owner')).toHaveLength(10);
  });
  it('admin tiles contain Invite User but not Billing', () => {
    const keys = quickActionsForRole('admin').map(a => a.key);
    expect(keys).toContain('inviteUser');
    expect(keys).not.toContain('billing');
  });
  it('owner tiles contain Billing, targeting the Subscription screen', () => {
    const billing = quickActionsForRole('owner').find(a => a.key === 'billing');
    expect(billing).toBeDefined();
    expect(billing?.destination).toBe('Subscription');
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
  it('Find Tool targets the Tools tab inside MainTabs with focusSearch', () => {
    const findTool = quickActionsForRole('site_worker').find(a => a.key === 'findTool');
    expect(findTool?.destination).toBe('MainTabs');
    expect(findTool?.params).toEqual({ screen: 'tools', params: { focusSearch: true } });
  });
});
