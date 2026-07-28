import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignments as assignmentsApi,
  organizations as organizationsApi,
  sites as sitesApi,
} from '../../../../api/endpoints';
import type {
  AssignmentRead,
  OrganizationRead,
  OrgStats,
  SiteRead,
} from '../../../../api/types';
import { useAuth } from '../../../../context/AuthContext';
import type { ControlRoomData, SiteSummary } from '../types';

interface RawData {
  org: OrganizationRead | null;
  stats: OrgStats | null;
  activeAssignments: AssignmentRead[];
  sites: SiteRead[];
}

const EMPTY_RAW: RawData = {
  org: null,
  stats: null,
  activeAssignments: [],
  sites: [],
};

export function useControlRoomData(): ControlRoomData {
  const { userData } = useAuth();
  const [raw, setRaw] = useState<RawData>(EMPTY_RAW);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    const results = await Promise.allSettled([
      organizationsApi.getMyOrganization(),
      // All scalar counts (tools/NFC tags/incidents/members) come from the
      // stats endpoint — no full-list downloads just to count client-side.
      organizationsApi.getOrgStats(),
      assignmentsApi.listAssignments({ status: 'active' }),
      sitesApi.listSites(),
    ]);
    const [orgR, statsR, assignR, sitesR] = results;
    const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failures.length > 0) {
      // Log each rejection but only surface a banner if EVERYTHING failed —
      // partial data is more useful than a wholesale empty dashboard.
      failures.forEach((f) => console.warn('[ControlRoom] endpoint failed:', f.reason));
      if (failures.length === results.length) {
        setError(
          failures[0].reason instanceof Error
            ? failures[0].reason.message
            : 'Failed to load control room data',
        );
      }
    }
    const assignPage = assignR.status === 'fulfilled' ? assignR.value : null;
    const sitesPage = sitesR.status === 'fulfilled' ? sitesR.value : null;
    setRaw({
      org: orgR.status === 'fulfilled' ? orgR.value : null,
      stats: statsR.status === 'fulfilled' ? statsR.value : null,
      activeAssignments: assignPage?.items ?? [],
      sites: sitesPage?.items ?? [],
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = useMemo<Omit<ControlRoomData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const orgName = (raw.org?.name ?? userData?.organization?.name ?? '').toUpperCase();
    const initials = computeInitials(userData?.first_name, userData?.last_name, userData?.email);

    const stats = raw.stats;
    const tags = stats?.tools.with_nfc_tag ?? null;
    const inUse = stats?.assignments.active ?? raw.activeAssignments.length;
    // Total can't be less than what's in use — guards the donut against a
    // "0 devices / N in use" display when the stats call failed under
    // backend flakiness.
    const devices = Math.max(raw.org?.tool_count ?? 0, stats?.tools.total ?? 0, inUse);
    const available = Math.max(0, devices - inUse);
    const maintenance = stats?.incidents.maintenance_due ?? 0;
    const criticalReports = stats?.incidents.critical ?? 0;

    const siteToolCount = groupActiveAssignmentsBySite(raw.activeAssignments);
    const topSites: SiteSummary[] = raw.sites
      .map((s) => ({
        id: s.id,
        prefixCode: s.prefix_code || s.nickname || s.name.slice(0, 3).toUpperCase(),
        name: s.name,
        toolCount: siteToolCount.get(s.id) ?? 0,
      }))
      .sort((a, b) => b.toolCount - a.toolCount)
      .slice(0, 3);

    const adminCount = stats?.members.admins ?? 0;
    const workerCount = stats?.members.workers ?? 0;

    const attentionTotal = criticalReports + maintenance;

    return {
      organizationName: orgName,
      userInitials: initials,
      hasUnreadAlerts: null,
      inventory: {
        devices,
        tags,
        available,
        inUse,
        maintenance,
        overdue: null,
      },
      attention: {
        total: attentionTotal,
        overdueReturns: null,
        criticalReports,
        maintenanceOverdue: maintenance,
      },
      sites: {
        total: stats?.sites.total ?? raw.org?.site_count ?? raw.sites.length,
        top: topSites,
      },
      members: {
        total: stats?.members.total ?? raw.org?.member_count ?? 0,
        admins: adminCount,
        workers: workerCount,
        scanningToday: null,
        idle: null,
      },
      compliance: {
        percent: null,
        patTestsDue: null,
        servicesOverdue: null,
        hiresEndingToday: null,
      },
    };
  }, [raw, userData]);

  return { ...data, isLoading, error, refresh: load };
}

function groupActiveAssignmentsBySite(assignments: AssignmentRead[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const a of assignments) {
    if (!a.assignee_site_id) continue;
    map.set(a.assignee_site_id, (map.get(a.assignee_site_id) ?? 0) + 1);
  }
  return map;
}

function computeInitials(first?: string | null, last?: string | null, email?: string | null): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f || l) {
    const a = f ? f[0] : '';
    const b = l ? l[0] : '';
    return (a + b).toUpperCase() || '?';
  }
  const e = (email ?? '').trim();
  return e ? e[0].toUpperCase() : '?';
}

// BACKEND_GAP: assignments lack `due_date` / `expected_return_at` field —
// cannot compute "overdue returns" client-side.
// BACKEND_GAP: members lack `last_active_at` / scan-event aggregation —
// cannot compute "scanning today" or "idle" counts.
// BACKEND_GAP: no compliance endpoint — PAT tests / service / hire data unavailable.
// BACKEND_GAP: no notifications endpoint feeding the bell badge.
