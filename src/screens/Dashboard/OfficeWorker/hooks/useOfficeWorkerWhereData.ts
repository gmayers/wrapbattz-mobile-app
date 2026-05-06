import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  sites as sitesApi,
  vans as vansApi,
  assignments as assignmentsApi,
  joinRequests as joinRequestsApi,
  organizations as organizationsApi,
} from '../../../../api/endpoints';
import type {
  AssignmentRead,
  OrganizationRead,
  SiteRead,
  VanRead,
} from '../../../../api/types';
import { useAuth } from '../../../../context/AuthContext';
import { computeInitials } from '../../shared/identity';
import type { LocationItem, WhereData } from '../types';

const TOOLBOX_TYPES = new Set(['toolbox', 'TOOLBOX']);

interface RawData {
  org: OrganizationRead | null;
  sites: SiteRead[];
  vans: VanRead[];
  activeAssignments: AssignmentRead[];
  pendingApprovals: number | null;
}

const EMPTY: RawData = {
  org: null,
  sites: [],
  vans: [],
  activeAssignments: [],
  pendingApprovals: null,
};

export function useOfficeWorkerWhereData(): WhereData {
  const { userData } = useAuth();
  const [raw, setRaw] = useState<RawData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [org, sitesPage, vansPage, assignmentsPage, joinRequestsPage] = await Promise.all([
        organizationsApi.getMyOrganization().catch(() => null),
        sitesApi.listSites(),
        vansApi.listVans(),
        assignmentsApi.listAssignments({ status: 'active' }),
        joinRequestsApi.listJoinRequests().catch(() => null),
      ]);
      setRaw({
        org,
        sites: sitesPage.items,
        vans: vansPage.items,
        activeAssignments: assignmentsPage.items,
        pendingApprovals: joinRequestsPage ? (joinRequestsPage.total ?? joinRequestsPage.items.length) : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<WhereData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const orgName = (raw.org?.name ?? userData?.organization?.name ?? '').toUpperCase();
    const userInitials = computeInitials(
      userData?.first_name,
      userData?.last_name,
      userData?.email,
    );

    const toolboxes = raw.sites.filter((s) => TOOLBOX_TYPES.has(s.site_type)).length;
    const sites = raw.sites.length - toolboxes;
    const vehicles = raw.vans.length;

    const byEmail = new Map<string, string>();
    for (const a of raw.activeAssignments) {
      const email = a.assignee_user_email || '';
      if (email && !byEmail.has(email)) {
        byEmail.set(email, computeInitials('', '', email));
      }
    }

    const siteToolCount = new Map<number, number>();
    const siteWorkerEmails = new Map<number, Set<string>>();
    const vanToolCount = new Map<number, number>();
    const vanWorkerEmails = new Map<number, Set<string>>();

    for (const a of raw.activeAssignments) {
      if (a.assignee_site_id == null) continue;
      const siteId = a.assignee_site_id;
      siteToolCount.set(siteId, (siteToolCount.get(siteId) ?? 0) + 1);
      if (a.assignee_user_email) {
        const set = siteWorkerEmails.get(siteId) ?? new Set();
        set.add(a.assignee_user_email);
        siteWorkerEmails.set(siteId, set);
      }
    }

    const locationsFromSites: LocationItem[] = raw.sites.map((s) => {
      const isToolbox = TOOLBOX_TYPES.has(s.site_type);
      const emails = siteWorkerEmails.get(s.id);
      const initials = emails ? Array.from(emails).map((e) => byEmail.get(e) ?? '?') : [];
      return {
        id: s.id,
        kind: isToolbox ? 'toolbox' : 'site',
        name: s.name,
        code: s.prefix_code || s.nickname || '',
        toolCount: siteToolCount.get(s.id) ?? 0,
        workerInitials: initials,
      };
    });

    // BACKEND_GAP: tools assigned to vans are not currently joined into
    // listAssignmentsBySite. Show 0 until vans gain a list-assignments path.
    const locationsFromVans: LocationItem[] = raw.vans.map((v) => ({
      id: v.id,
      kind: 'vehicle',
      name: v.name,
      code: v.prefix_code || v.nickname || '',
      toolCount: vanToolCount.get(v.id) ?? 0,
      workerInitials: Array.from(vanWorkerEmails.get(v.id) ?? []).map((e) => byEmail.get(e) ?? '?'),
    }));

    const locations = [...locationsFromSites, ...locationsFromVans];
    const totalToolsPlaced = raw.activeAssignments.filter((a) => a.assignee_site_id != null).length;

    return {
      organizationName: orgName,
      userInitials,
      hasUnreadAlerts: null,
      counts: { sites, vehicles, toolboxes, total: raw.sites.length + raw.vans.length },
      totalToolsPlaced,
      locations,
      pendingApprovals: raw.pendingApprovals,
      returnsDue: null,
    };
  }, [raw, userData]);

  return { ...data, isLoading, error, refresh: load };
}
