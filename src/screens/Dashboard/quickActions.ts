import type { Role } from '../../navigation/mainTabs';

export interface QuickAction {
  key: string;
  label: string;
  icon: string;
  destination?: string;
  onPressType?: 'scan';
}

const WORKER_ACTIONS: QuickAction[] = [
  { key: 'scan',          label: 'Scan',          icon: 'scan-circle-outline', onPressType: 'scan' },
  { key: 'reportIssue',   label: 'Report Issue',  icon: 'alert-circle-outline', destination: 'CreateReport' },
  { key: 'myTools',       label: 'My Tools',      icon: 'construct-outline',    destination: 'MainTabs' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', destination: 'NotificationPreferences' },
];

const ADMIN_EXTRAS: QuickAction[] = [
  { key: 'addTool',    label: 'Add Tool',    icon: 'add-circle-outline',   destination: 'AddDevice' },
  { key: 'sites',      label: 'Sites',       icon: 'business-outline',     destination: 'MainTabs' },
  { key: 'inviteUser', label: 'Invite User', icon: 'person-add-outline',   destination: 'Members' },
  { key: 'billing',    label: 'Billing',     icon: 'card-outline',         destination: 'ManageBilling' },
];

export function quickActionsForRole(role: Role | undefined): QuickAction[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  return isAdminOrOwner ? [...WORKER_ACTIONS, ...ADMIN_EXTRAS] : WORKER_ACTIONS;
}
