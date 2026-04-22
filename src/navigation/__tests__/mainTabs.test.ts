import { tabsForRole } from '../mainTabs';

describe('tabsForRole', () => {
  it('returns 5 tabs in worker layout for site_worker', () => {
    const tabs = tabsForRole('site_worker');
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'incidents', 'settings']);
  });

  it('returns 5 tabs in worker layout for office_worker', () => {
    const tabs = tabsForRole('office_worker');
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'incidents', 'settings']);
  });

  it('returns 5 tabs in admin layout for admin', () => {
    const tabs = tabsForRole('admin');
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'sites', 'settings']);
  });

  it('returns 5 tabs in admin layout for owner', () => {
    const tabs = tabsForRole('owner');
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'sites', 'settings']);
  });

  it('defaults to worker layout when role is undefined', () => {
    const tabs = tabsForRole(undefined);
    expect(tabs.map(t => t.key)).toEqual(['dashboard', 'tools', 'scan', 'incidents', 'settings']);
  });

  it('marks scan as a FAB in slot 3', () => {
    const tabs = tabsForRole('admin');
    expect(tabs[2].key).toBe('scan');
    expect(tabs[2].isFab).toBe(true);
  });

  it('no non-scan tab is a FAB', () => {
    const tabs = tabsForRole('admin');
    tabs.filter(t => t.key !== 'scan').forEach(t => {
      expect(t.isFab).toBeFalsy();
    });
  });
});
