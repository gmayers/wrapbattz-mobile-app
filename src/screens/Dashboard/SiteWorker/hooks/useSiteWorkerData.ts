import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignments as assignmentsApi,
  incidents as incidentsApi,
  sites as sitesApi,
  siteAssignments as siteAssignmentsApi,
  organizations as organizationsApi,
} from '../../../../api/endpoints';
import type {
  AssignmentRead,
  IncidentRead,
  OrganizationRead,
  SiteAssignmentRead,
  SiteRead,
} from '../../../../api/types';
import { useAuth } from '../../../../context/AuthContext';
import { computeInitials } from '../../shared/identity';
import type { ActionRow, SiteWorkerData } from '../types';

const EOD_HOUR = 16;
const LOCATION_PAGE_SIZE = 200;

interface RawData {
  org: OrganizationRead | null;
  active: AssignmentRead[];
  returnedPage: { items: AssignmentRead[] };
  incidents: IncidentRead[];
  vehicleSites: SiteRead[];
  mySiteAssignments: SiteAssignmentRead[];
}

const EMPTY: RawData = {
  org: null, active: [], returnedPage: { items: [] }, incidents: [], vehicleSites: [], mySiteAssignments: [],
};

const CLOSED_STATUSES = new Set(['resolved', 'closed', 'cancelled', 'RESOLVED', 'CLOSED', 'CANCELLED']);

export function useSiteWorkerData(): SiteWorkerData {
  const { userData } = useAuth();
  const myUserId = userData?.id;
  const [raw, setRaw] = useState<RawData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      // BACKEND_GAP: org-local "today" — comparing UTC ISO date strings.
      // Replace with org-tz-aware comparison once the server agrees a timezone contract.
      const [org, active, returnedPage, incidentsPage, sitesPage, mySaPage] = await Promise.all([
        organizationsApi.getMyOrganization().catch(() => null),
        assignmentsApi.listMyActiveAssignments(),
        assignmentsApi.listMyAssignments('returned'),
        incidentsApi.listMyIncidents(),
        sitesApi.listSites({ site_type: 'vehicle', page_size: LOCATION_PAGE_SIZE }),
        myUserId
          ? siteAssignmentsApi.listSiteAssignments({ user: myUserId })
          : Promise.resolve({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 }),
      ]);
      setRaw({
        org,
        active,
        returnedPage: { items: returnedPage.items },
        incidents: incidentsPage.items,
        vehicleSites: sitesPage.items,
        mySiteAssignments: mySaPage.items,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      setIsLoading(false);
    }
  }, [myUserId]);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<SiteWorkerData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const todayIso = new Date().toISOString().slice(0, 10);

    const overdue = raw.active.filter((a) =>
      a.expected_return_at && a.expected_return_at < todayIso && !a.returned_at
    );
    const dueToday = raw.active.filter((a) =>
      a.expected_return_at === todayIso && !a.returned_at
    );

    // BACKEND_GAP: AssignmentRead.returned_at lacks an explicit `Format: date-time`
    // in the openapi schema, so we assume the API returns a plain YYYY-MM-DD date
    // string. If the backend ever returns a datetime, this equality silently fails
    // and "RETURNED" reads 0 — confirm on device, swap to date-prefix comparison if needed.
    const returnedToday = raw.returnedPage.items.filter((a) =>
      a.returned_at === todayIso
    ).length;

    const flaggedIncidents = raw.incidents.filter((i) => !CLOSED_STATUSES.has(i.status));

    const vanSiteIds = new Set(raw.vehicleSites.map((v) => v.id));
    const vanAssignments = raw.active.filter((a) =>
      a.assignee_site_id != null && vanSiteIds.has(a.assignee_site_id)
    );

    const rows: ActionRow[] = [];

    for (const a of overdue.sort((x, y) => (x.expected_return_at ?? '').localeCompare(y.expected_return_at ?? ''))) {
      const days = a.expected_return_at ? daysBetween(a.expected_return_at, todayIso) : 0;
      rows.push({
        id: `overdue-${a.id}`,
        kind: 'overdue',
        iconName: 'time-outline',
        iconTint: '#F85149', // red
        primary: a.tool_name || `Tool #${a.tool_id}`,
        secondary: `Return overdue · ${days} ${days === 1 ? 'day' : 'days'}`,
        cta: { kind: 'return', label: 'Return' },
        payload: { assignmentId: a.id, toolId: a.tool_id },
      });
    }

    for (const a of dueToday) {
      rows.push({
        id: `due-${a.id}`,
        kind: 'due_today',
        iconName: 'time-outline',
        primary: a.tool_name || `Tool #${a.tool_id}`,
        secondary: 'Return due today',
        cta: { kind: 'return', label: 'Return' },
        payload: { assignmentId: a.id, toolId: a.tool_id },
      });
    }

    for (const i of flaggedIncidents) {
      rows.push({
        id: `flagged-${i.id}`,
        kind: 'flagged',
        iconName: 'construct-outline',
        primary: i.tool_name || `Tool #${i.tool_id}`,
        secondary: truncate(i.description) || `${i.type} flagged`,
        cta: { kind: 'log', label: 'Log' },
        payload: { incidentId: i.id, toolId: i.tool_id },
      });
    }

    const now = new Date();
    // BACKEND_GAP: org-tz-aware comparison not yet defined; use UTC per project default.
    if (now.getUTCHours() >= EOD_HOUR && vanAssignments.length > 0) {
      const firstVanId = vanAssignments[0].assignee_site_id ?? null;
      const van = firstVanId != null
        ? raw.vehicleSites.find((v) => v.id === firstVanId)
        : undefined;
      const vanLabel = van?.prefix_code || van?.name || 'your van';
      rows.push({
        id: 'eod-return',
        kind: 'eod',
        iconName: 'scan-outline',
        primary: 'End-of-day return',
        secondary: `Scan ${vanAssignments.length} item${vanAssignments.length === 1 ? '' : 's'} back to ${vanLabel}`,
        cta: { kind: 'scan', label: 'Scan' },
        payload: { vanId: firstVanId ?? undefined },
      });
    }

    const orgName = (raw.org?.name ?? userData?.organization?.name ?? '').toUpperCase();
    const activeSa = raw.mySiteAssignments.find((s) => s.is_active);
    // BACKEND_GAP: SiteAssignmentRead has site_name but no prefix_code, so we cannot
    // render the prefixed tagline (e.g. "CHW-04 / CHELSEA WHARF") without a second
    // sites.getSite() lookup. Render the upper-cased site_name only for v1.
    const siteTagline = activeSa
      ? (activeSa.site_name ?? '').toUpperCase()
      : `${orgName || 'YOUR ORGANIZATION'} / SITE`;

    return {
      organizationName: orgName,
      siteTagline,
      userInitials: computeInitials(userData?.first_name, userData?.last_name, userData?.email),
      hasUnreadAlerts: null,
      checkedOut: raw.active.length,
      returnedToday,
      overdueCount: overdue.length,
      rows,
    };
  }, [raw, userData]);

  return { ...data, isLoading, error, refresh: load };
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function truncate(s: string | undefined | null, max = 36): string {
  if (!s) return '';
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
