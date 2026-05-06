export interface InventoryStats {
  devices: number;
  tags: number | null;
  available: number;
  inUse: number;
  maintenance: number;
  overdue: number | null;
}

export interface AttentionStats {
  total: number;
  overdueReturns: number | null;
  criticalReports: number;
  maintenanceOverdue: number;
}

export interface SiteSummary {
  id: number;
  prefixCode: string;
  name: string;
  toolCount: number;
}

export interface SitesStats {
  total: number;
  top: SiteSummary[];
}

export interface MembersStats {
  total: number;
  admins: number;
  workers: number;
  scanningToday: number | null;
  idle: number | null;
}

export interface ComplianceStats {
  percent: number | null;
  patTestsDue: number | null;
  servicesOverdue: number | null;
  hiresEndingToday: number | null;
}

export interface ControlRoomData {
  isLoading: boolean;
  error?: string;
  organizationName: string;
  userInitials: string;
  hasUnreadAlerts: boolean | null;
  inventory: InventoryStats;
  attention: AttentionStats;
  sites: SitesStats;
  members: MembersStats;
  compliance: ComplianceStats;
  refresh: () => void;
}
