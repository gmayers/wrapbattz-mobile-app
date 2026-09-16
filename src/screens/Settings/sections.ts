import type { Role } from '../../navigation/mainTabs';

export type RoleGate = 'all' | 'admin' | 'owner';

export interface SettingsRow {
  key: string;
  label: string;
  icon: string;
  kind: 'nav' | 'action' | 'themePicker';
  destination?: string;
  params?: Record<string, unknown>;
  onPressType?: 'logout' | 'deleteAccount' | 'whatsNew' | 'addDemoData' | 'removeDemoData' | 'resetOnboarding';
  destructive?: boolean;
}

export interface SettingsSection {
  key: string;
  title: string;
  requiredRole: RoleGate;
  rows: SettingsRow[];
}

const ALL_SECTIONS: SettingsSection[] = [
  {
    key: 'account',
    title: 'Account',
    requiredRole: 'all',
    rows: [
      { key: 'profile',        label: 'Profile',              icon: 'person-circle-outline', kind: 'nav', destination: 'EditProfile' },
      { key: 'changePassword', label: 'Change Password',      icon: 'key-outline',           kind: 'nav', destination: 'ChangePassword' },
      // 'SecurityPreferences' (biometric/PIN) screen not built yet.
      // Replays the setup wizard for this user only — no organisation data,
      // tools or members are touched. Backed by PATCH /account/onboarding/.
      { key: 'resetOnboarding', label: 'Reset Onboarding', icon: 'refresh-outline', kind: 'action', onPressType: 'resetOnboarding' },
      // App Store guideline 5.1.1(v): account creation requires in-app deletion.
      { key: 'deleteAccount',  label: 'Delete Account',       icon: 'trash-outline',         kind: 'action', onPressType: 'deleteAccount', destructive: true },
    ],
  },
  {
    key: 'preferences',
    title: 'Preferences',
    requiredRole: 'all',
    rows: [
      { key: 'theme', label: 'Theme', icon: 'color-palette-outline', kind: 'themePicker' },
    ],
  },
  {
    key: 'organization',
    title: 'Organization',
    requiredRole: 'admin',
    rows: [
      { key: 'orgDetails', label: 'Org Details', icon: 'business-outline',  kind: 'nav', destination: 'CreateOrganization', params: { mode: 'edit' } },
      { key: 'members',    label: 'Members',     icon: 'people-outline',    kind: 'nav', destination: 'Members' },
      // Same sample data as the web portal's demo-tools buttons; backend
      // create is idempotent so re-adding after a remove is safe.
      { key: 'addDemoTools',    label: 'Add Demo Tools',    icon: 'construct-outline', kind: 'action', onPressType: 'addDemoData' },
      { key: 'removeDemoTools', label: 'Remove Demo Tools', icon: 'trash-bin-outline', kind: 'action', onPressType: 'removeDemoData', destructive: true },
      // 'InviteCode' screen not built yet.
    ],
  },
  {
    key: 'billing',
    title: 'Billing',
    requiredRole: 'owner',
    rows: [
      { key: 'subscription', label: 'Subscription', icon: 'card-outline', kind: 'nav', destination: 'Subscription' },
    ],
  },
  {
    key: 'support',
    title: 'Support',
    requiredRole: 'all',
    rows: [
      { key: 'whatsNew',       label: "What's New",         icon: 'sparkles-outline',           kind: 'action', onPressType: 'whatsNew' },
      { key: 'suggestFeature', label: 'Suggest a Feature', icon: 'bulb-outline',               kind: 'nav', destination: 'SuggestFeature' },
      // 'About' screen not built yet.
    ],
  },
  {
    key: 'logout',
    title: '',
    requiredRole: 'all',
    rows: [
      { key: 'logout', label: 'Logout', icon: 'log-out-outline', kind: 'action', onPressType: 'logout', destructive: true },
    ],
  },
];

export function getSectionsForRole(role: Role | undefined): SettingsSection[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  return ALL_SECTIONS.filter(s => {
    if (s.requiredRole === 'owner') return role === 'owner';
    return s.requiredRole === 'all' || isAdminOrOwner;
  });
}
