export type TabKey = 'dashboard' | 'tools' | 'scan' | 'incidents' | 'sites' | 'settings';
export type Role = 'owner' | 'admin' | 'office_worker' | 'site_worker';

export interface TabConfig {
  key: TabKey;
  label: string;
  icon: string;
  iconFocused: string;
  isFab?: boolean;
}

const ALL_TABS: Record<TabKey, TabConfig> = {
  dashboard: { key: 'dashboard', label: 'Dashboard', icon: 'home-outline', iconFocused: 'home' },
  tools:     { key: 'tools',     label: 'Tools',     icon: 'construct-outline', iconFocused: 'construct' },
  scan:      { key: 'scan',      label: 'Scan',      icon: 'scan-circle-outline', iconFocused: 'scan-circle', isFab: true },
  incidents: { key: 'incidents', label: 'Incidents', icon: 'document-text-outline', iconFocused: 'document-text' },
  sites:     { key: 'sites',     label: 'Sites',     icon: 'business-outline', iconFocused: 'business' },
  settings:  { key: 'settings',  label: 'Settings',  icon: 'settings-outline', iconFocused: 'settings' },
};

export function tabsForRole(role: Role | undefined): TabConfig[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  const keys: TabKey[] = isAdminOrOwner
    ? ['dashboard', 'tools', 'scan', 'sites', 'settings']
    : ['dashboard', 'tools', 'scan', 'incidents', 'settings'];
  return keys.map(k => ALL_TABS[k]);
}
