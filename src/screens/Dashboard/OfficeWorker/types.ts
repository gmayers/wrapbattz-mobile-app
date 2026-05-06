import type { LocationKind } from '../shared/components/KindBadge';

export interface LocationItem {
  id: number;
  kind: LocationKind;
  name: string;
  code: string;
  toolCount: number;
  workerInitials: string[];
}

export interface WhereData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;
  organizationName: string;
  userInitials: string;
  hasUnreadAlerts: boolean | null;
  counts: { sites: number; vehicles: number; toolboxes: number; total: number };
  totalToolsPlaced: number;
  locations: LocationItem[];
  pendingApprovals: number | null;
  returnsDue: number | null;
}

export interface MemberRow {
  memberId: number;
  initials: string;
  name: string;
  metaPrimary: string;
  metaSecondary?: string;
  toolCount: number;
}

export interface TeamData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;
  organizationName: string;
  userInitials: string;
  hasUnreadAlerts: boolean | null;
  totalMembers: number;
  totalToolsOut: number;
  onSite: number | null;
  hq: number | null;
  members: MemberRow[];
}
