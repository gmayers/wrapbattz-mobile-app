import type { Role } from '../../../navigation/mainTabs';

export interface WorkerStats {
  toolsAssigned: number;
  openIncidents: number;
  sites: number;
}

export interface AdminStats {
  activeTools: number;
  inUse: number;
  missing: number;
  maintenanceDue: number;
}

export interface DashboardStats {
  isLoading: boolean;
  role: 'worker' | 'admin';
  worker?: WorkerStats;
  admin?: AdminStats;
}

export function useDashboardStats(role: Role | undefined): DashboardStats {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  return {
    isLoading: true,
    role: isAdminOrOwner ? 'admin' : 'worker',
    worker: isAdminOrOwner ? undefined : { toolsAssigned: 0, openIncidents: 0, sites: 0 },
    admin: isAdminOrOwner ? { activeTools: 0, inUse: 0, missing: 0, maintenanceDue: 0 } : undefined,
  };
}
