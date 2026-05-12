import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignments as assignmentsApi,
  incidents as incidentsApi,
  members as membersApi,
  organizations as organizationsApi,
  sites as sitesApi,
  tools as toolsApi,
} from '../../../../api/endpoints';
import type {
  AssignmentRead,
  IncidentRead,
  MemberRead,
  OrganizationRead,
  SiteRead,
  ToolRead,
} from '../../../../api/types';
import { useAuth } from '../../../../context/AuthContext';
import type { ControlRoomData, SiteSummary } from '../types';

const TOOLS_PAGE_SIZE = 200;
const MEMBERS_PAGE_SIZE = 200;
const ASSIGNMENTS_PAGE_SIZE = 500;

const CRITICAL_SEVERITIES = new Set(['critical', 'high', 'CRITICAL', 'HIGH']);
const MAINTENANCE_TYPES = new Set([
  'maintenance',
  'maintenance_due',
  'MAINTENANCE',
  'MAINTENANCE_DUE',
]);
const CLOSED_STATUSES = new Set([
  'resolved',
  'RESOLVED',
  'cancelled',
  'CANCELLED',
  'closed',
  'CLOSED',
]);

interface RawData {
  org: OrganizationRead | null;
  tools: ToolRead[];
  toolsTotal: number;
  activeAssignments: AssignmentRead[];
  incidents: IncidentRead[];
  sites: SiteRead[];
  members: MemberRead[];
}

const EMPTY_RAW: RawData = {
  org: null,
  tools: [],
  toolsTotal: 0,
  activeAssignments: [],
  incidents: [],
  sites: [],
  members: [],
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
      toolsApi.listTools({ page_size: TOOLS_PAGE_SIZE }),
      assignmentsApi.listAssignments({ status: 'active' }),
      incidentsApi.listIncidents(),
      sitesApi.listSites(),
      membersApi.listMembers(),
    ]);
    const [orgR, toolsR, assignR, incR, sitesR, membersR] = results;
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
    const toolsPage = toolsR.status === 'fulfilled' ? toolsR.value : null;
    const assignPage = assignR.status === 'fulfilled' ? assignR.value : null;
    const incPage = incR.status === 'fulfilled' ? incR.value : null;
    const sitesPage = sitesR.status === 'fulfilled' ? sitesR.value : null;
    const membersPage = membersR.status === 'fulfilled' ? membersR.value : null;
    setRaw({
      org: orgR.status === 'fulfilled' ? orgR.value : null,
      tools: toolsPage?.items ?? [],
      toolsTotal: toolsPage?.total ?? toolsPage?.items?.length ?? 0,
      activeAssignments: assignPage?.items ?? [],
      incidents: incPage?.items ?? [],
      sites: sitesPage?.items ?? [],
      members: membersPage?.items ?? [],
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = useMemo<Omit<ControlRoomData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const orgName = (raw.org?.name ?? userData?.organization?.name ?? '').toUpperCase();
    const initials = computeInitials(userData?.first_name, userData?.last_name, userData?.email);

    const devices = raw.org?.tool_count ?? raw.toolsTotal;
    const tags = countTaggedTools(raw.tools);
    const inUse = raw.activeAssignments.length;
    const available = Math.max(0, devices - inUse);
    const openIncidents = raw.incidents.filter((i) => !CLOSED_STATUSES.has(i.status));
    const maintenance = openIncidents.filter((i) => MAINTENANCE_TYPES.has(i.type)).length;
    const criticalReports = openIncidents.filter((i) => CRITICAL_SEVERITIES.has(i.severity)).length;

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

    const adminCount = raw.members.filter((m) => isAdminLike(m.role)).length;
    const workerCount = raw.members.length - adminCount;

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
        total: raw.org?.site_count ?? raw.sites.length,
        top: topSites,
      },
      members: {
        total: raw.org?.member_count ?? raw.members.length,
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

function countTaggedTools(tools: ToolRead[]): number | null {
  if (tools.length === 0) return 0;
  return tools.filter((t) => !!t.nfc_tag_id && t.nfc_tag_id.length > 0).length;
}

function groupActiveAssignmentsBySite(assignments: AssignmentRead[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const a of assignments) {
    if (!a.assignee_site_id) continue;
    map.set(a.assignee_site_id, (map.get(a.assignee_site_id) ?? 0) + 1);
  }
  return map;
}

function isAdminLike(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'office_worker';
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
// BACKEND_GAP: tools `total` is paginated; if org has > TOOLS_PAGE_SIZE tools
// the tag count under-reports. Need a `/tools/stats` endpoint or
// `nfc_tag_id__isnull=False` filter for an authoritative count.
