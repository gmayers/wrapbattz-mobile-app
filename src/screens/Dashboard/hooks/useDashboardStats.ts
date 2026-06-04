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
      // allSettled, not all: a single slow/failed endpoint must not blank the
      // whole stats row. Each stat falls back to 0; surface an error only when
      // every call failed.
      if (isAdminOrOwner) {
        const [toolsR, activeR, incidentsR] = await Promise.allSettled([
          toolsApi.listTools({ page: 1, page_size: 1 }),
          assignmentsApi.listAssignments({ status: 'active' }),
          incidentsApi.listIncidents(),
        ]);
        const toolsPage = toolsR.status === 'fulfilled' ? toolsR.value : null;
        const activeAssignments = activeR.status === 'fulfilled' ? activeR.value : null;
        const incidentsPage = incidentsR.status === 'fulfilled' ? incidentsR.value : null;
        const openIncidents = (incidentsPage?.items ?? []).filter(
          (i) => !CLOSED_STATUSES.has(i.status)
        );
        setAdmin({
          activeTools: toolsPage?.total ?? 0,
          inUse: activeAssignments?.total ?? 0,
          missing: openIncidents.filter((i) => MISSING_TYPES.has(i.type)).length,
          maintenanceDue: openIncidents.filter((i) => MAINTENANCE_TYPES.has(i.type)).length,
        });
        setWorker(undefined);
        if (!toolsPage && !activeAssignments && !incidentsPage) {
          setError('Failed to load stats');
        }
      } else {
        const [mineR, myIncR, sitesR] = await Promise.allSettled([
          assignmentsApi.listMyActiveAssignments(),
          incidentsApi.listMyIncidents(),
          sitesApi.listSites(),
        ]);
        const mineActive = mineR.status === 'fulfilled' ? mineR.value : null;
        const myIncidents = myIncR.status === 'fulfilled' ? myIncR.value : null;
        const sitesPage = sitesR.status === 'fulfilled' ? sitesR.value : null;
        const open = (myIncidents?.items ?? []).filter((i) => !CLOSED_STATUSES.has(i.status));
        setWorker({
          toolsAssigned: mineActive?.length ?? 0,
          openIncidents: open.length,
          sites: sitesPage?.total ?? sitesPage?.items.length ?? 0,
        });
        setAdmin(undefined);
        if (!mineActive && !myIncidents && !sitesPage) {
          setError('Failed to load stats');
        }
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
