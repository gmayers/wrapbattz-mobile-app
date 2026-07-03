import type { Role } from '../../navigation/mainTabs';

export interface QuickAction {
  key: string;
  label: string;
  icon: string;
  destination?: string;
  /** Params for the destination — used to target a specific tab inside MainTabs. */
  params?: Record<string, unknown>;
  onPressType?: 'scan';
}

const WORKER_ACTIONS: QuickAction[] = [
  { key: 'scan',          label: 'Scan',          icon: 'scan-circle-outline',  onPressType: 'scan' },
  { key: 'whoHasIt',      label: 'Who has it?',   icon: 'search-outline',       onPressType: 'scan' },
  { key: 'reportIssue',   label: 'Report Issue',  icon: 'alert-circle-outline', destination: 'CreateReport' },
  // Open the Tools tab inside MainTabs — navigating to bare 'MainTabs' lands on
  // Dashboard, so the button appeared unlinked.
  { key: 'myTools',       label: 'My Tools',      icon: 'construct-outline',    destination: 'MainTabs', params: { screen: 'tools' } },
  { key: 'findTool',      label: 'Find Tool',     icon: 'search-circle-outline', destination: 'MainTabs', params: { screen: 'tools', params: { focusSearch: true } } },
];

const ADMIN_EXTRAS: QuickAction[] = [
  { key: 'addTool',    label: 'Add Tool',    icon: 'add-circle-outline',   destination: 'AddDevice' },
  { key: 'sites',      label: 'Sites',       icon: 'business-outline',     destination: 'MainTabs', params: { screen: 'sites' } },
  { key: 'inviteUser', label: 'Invite User', icon: 'person-add-outline',   destination: 'Members' },
  { key: 'billing',    label: 'Billing',     icon: 'card-outline',         destination: 'ManageBilling' },
  // Notification preferences (incl. billing recipients) are admin/owner-only —
  // showing this to site workers produced an "access denied" popup.
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', destination: 'NotificationPreferences' },
];

export function quickActionsForRole(role: Role | undefined): QuickAction[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  return isAdminOrOwner ? [...WORKER_ACTIONS, ...ADMIN_EXTRAS] : WORKER_ACTIONS;
}
