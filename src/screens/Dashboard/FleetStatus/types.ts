export type ExceptionKind = 'overdue' | 'report' | 'maintenance';

export interface FleetException {
  id: string;
  kind: ExceptionKind;
  toolId?: number;
  incidentId?: number;
  toolName: string;
  ageLabel: string;
  detailLabel: string;
  severityColor: 'red' | 'amber';
}

export interface FleetInventory {
  total: number;
  available: number;
  inUse: number;
  maintenance: number;
  missing: number | null;
  tagsUsed: number;
  tagsTotal: number | null;
  taggedPercent: number | null;
}

export interface FleetStatusData {
  isLoading: boolean;
  error?: string;
  organizationName: string;
  userInitials: string;
  hasUnreadAlerts: boolean | null;
  inventory: FleetInventory;
  exceptions: FleetException[];
  exceptionsTotal: number | null;
  refresh: () => void;
}
