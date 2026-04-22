import type { Role } from '../../navigation/mainTabs';

export type RoleGate = 'all' | 'admin';

export interface SettingsRow {
  key: string;
  label: string;
  icon: string;
  kind: 'nav' | 'action' | 'themePicker';
  destination?: string;
  onPressType?: 'logout';
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
      { key: 'security',       label: 'Biometric & PIN',      icon: 'finger-print-outline',  kind: 'nav', destination: 'SecurityPreferences' },
    ],
  },
  {
    key: 'preferences',
    title: 'Preferences',
    requiredRole: 'all',
    rows: [
      { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', kind: 'nav', destination: 'NotificationPreferences' },
      { key: 'theme',         label: 'Theme',         icon: 'color-palette-outline', kind: 'themePicker' },
    ],
  },
  {
    key: 'organization',
    title: 'Organization',
    requiredRole: 'admin',
    rows: [
      { key: 'orgDetails', label: 'Org Details', icon: 'business-outline',  kind: 'nav', destination: 'CreateOrganization' },
      { key: 'members',    label: 'Members',     icon: 'people-outline',    kind: 'nav', destination: 'Members' },
      { key: 'inviteCode', label: 'Invite Code', icon: 'link-outline',      kind: 'nav', destination: 'InviteCode' },
    ],
  },
  {
    key: 'billing',
    title: 'Billing',
    requiredRole: 'admin',
    rows: [
      { key: 'manageBilling',    label: 'Manage Billing',      icon: 'card-outline',        kind: 'nav', destination: 'ManageBilling' },
      { key: 'paymentHistory',   label: 'Payment History',     icon: 'receipt-outline',     kind: 'nav', destination: 'PaymentHistory' },
      { key: 'dataHandlingFee',  label: 'Data Handling Fee',   icon: 'document-outline',    kind: 'nav', destination: 'DataHandlingFee' },
      { key: 'billingAnalytics', label: 'Billing Analytics',   icon: 'stats-chart-outline', kind: 'nav', destination: 'BillingAnalytics' },
    ],
  },
  {
    key: 'support',
    title: 'Support',
    requiredRole: 'all',
    rows: [
      { key: 'suggestFeature', label: 'Suggest a Feature', icon: 'bulb-outline',               kind: 'nav', destination: 'SuggestFeature' },
      { key: 'about',          label: 'About',             icon: 'information-circle-outline',  kind: 'nav', destination: 'About' },
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
  return ALL_SECTIONS.filter(s => s.requiredRole === 'all' || isAdminOrOwner);
}
