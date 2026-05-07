import { tabAccents, isTabAccentKey, TabAccentKey } from '../tabAccents';

describe('tabAccents', () => {
  const keys: TabAccentKey[] = ['dashboard', 'tools', 'incidents', 'sites', 'settings'];

  it('defines an accent for every supported tab key', () => {
    for (const key of keys) {
      expect(tabAccents[key]).toBeDefined();
      expect(tabAccents[key].fg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(tabAccents[key].bg).toMatch(/^rgba\(/);
      expect(tabAccents[key].ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('maps Dashboard to amber', () => {
    expect(tabAccents.dashboard.fg).toBe('#FFC72C');
  });

  it('maps Tools to blue', () => {
    expect(tabAccents.tools.fg).toBe('#58A6FF');
  });

  it('maps Incidents to orange', () => {
    expect(tabAccents.incidents.fg).toBe('#F97316');
  });

  it('maps Sites to green', () => {
    expect(tabAccents.sites.fg).toBe('#22C55E');
  });

  it('maps Settings to violet', () => {
    expect(tabAccents.settings.fg).toBe('#A78BFA');
  });

  it('isTabAccentKey returns true for known keys', () => {
    for (const key of keys) {
      expect(isTabAccentKey(key)).toBe(true);
    }
  });

  it('isTabAccentKey returns false for unknown keys', () => {
    expect(isTabAccentKey('scan')).toBe(false);
    expect(isTabAccentKey('foo')).toBe(false);
    expect(isTabAccentKey(null as any)).toBe(false);
  });
});
