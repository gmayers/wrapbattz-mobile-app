import { useCallback, useEffect, useState } from 'react';
import type { Role } from '../../../navigation/mainTabs';
import {
  assignments as assignmentsApi,
  incidents as incidentsApi,
  sites as sitesApi,
  tools as toolsApi,
} from '../../../api/endpoints';

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
  refresh: () => void;
  error?: string;
}

const CLOSED_STATUSES = new Set(['resolved', 'RESOLVED', 'cancelled', 'CANCELLED', 'closed']);
const MISSING_TYPES = new Set(['missing', 'lost', 'stolen', 'MISSING', 'LOST', 'STOLEN']);
const MAINTENANCE_TYPES = new Set([
  'maintenance',
  'maintenance_due',
  'MAINTENANCE',
]);

export function useDashboardStats(role: Role | undefined): DashboardStats {
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  const [isLoading, setIsLoading] = useState(true);
  const [worker, setWorker] = useState<WorkerStats | undefined>(undefined);
  const [admin, setAdmin] = useState<AdminStats | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      if (isAdminOrOwner) {
        const [toolsPage, activeAssignments, incidentsPage] = await Promise.all([
          toolsApi.listTools({ page: 1, page_size: 1 }),
          assignmentsApi.listAssignments({ status: 'active' }),
          incidentsApi.listIncidents(),
        ]);
        const openIncidents = incidentsPage.items.filter(
          (i) => !CLOSED_STATUSES.has(i.status)
        );
        setAdmin({
          activeTools: toolsPage.total ?? 0,
          inUse: activeAssignments.total ?? 0,
          missing: openIncidents.filter((i) => MISSING_TYPES.has(i.type)).length,
          maintenanceDue: openIncidents.filter((i) => MAINTENANCE_TYPES.has(i.type)).length,
        });
        setWorker(undefined);
      } else {
        const [mineActive, myIncidents, sitesPage] = await Promise.all([
          assignmentsApi.listMyActiveAssignments(),
          incidentsApi.listMyIncidents(),
          sitesApi.listSites(),
        ]);
        const open = myIncidents.items.filter((i) => !CLOSED_STATUSES.has(i.status));
        setWorker({
          toolsAssigned: mineActive.length,
          openIncidents: open.length,
          sites: sitesPage.total ?? sitesPage.items.length,
        });
        setAdmin(undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, [isAdminOrOwner]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    isLoading,
    role: isAdminOrOwner ? 'admin' : 'worker',
    worker,
    admin,
    refresh: load,
    error,
  };
}
