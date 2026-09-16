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
];

// Billing is owner-only: it manages the org's Stripe subscription, which
// admins cannot see or act on (see Settings sections.ts).
const OWNER_EXTRAS: QuickAction[] = [
  { key: 'billing', label: 'Billing', icon: 'card-outline', destination: 'Subscription' },
];

export function quickActionsForRole(role: Role | undefined): QuickAction[] {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  if (!isAdminOrOwner) return WORKER_ACTIONS;
  return role === 'owner'
    ? [...WORKER_ACTIONS, ...ADMIN_EXTRAS, ...OWNER_EXTRAS]
    : [...WORKER_ACTIONS, ...ADMIN_EXTRAS];
}
