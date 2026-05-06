import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignments as assignmentsApi,
  incidents as incidentsApi,
  organizations as organizationsApi,
  tools as toolsApi,
} from '../../../../api/endpoints';
import type {
  AssignmentRead,
  IncidentRead,
  OrganizationRead,
  ToolRead,
} from '../../../../api/types';
import { useAuth } from '../../../../context/AuthContext';
import type { FleetException, FleetStatusData } from '../types';

const TOOLS_PAGE_SIZE = 200;

const CLOSED_STATUSES = new Set([
  'resolved',
  'RESOLVED',
  'cancelled',
  'CANCELLED',
  'closed',
  'CLOSED',
]);
const MAINTENANCE_TYPES = new Set([
  'maintenance',
  'maintenance_due',
  'MAINTENANCE',
  'MAINTENANCE_DUE',
]);
const MISSING_TYPES = new Set(['missing', 'lost', 'stolen', 'MISSING', 'LOST', 'STOLEN']);
const DAMAGE_TYPES = new Set(['damage', 'damaged', 'DAMAGE', 'DAMAGED']);
const HIGH_SEVERITIES = new Set(['critical', 'high', 'CRITICAL', 'HIGH']);

interface RawData {
  org: OrganizationRead | null;
  tools: ToolRead[];
  toolsTotal: number;
  activeAssignments: AssignmentRead[];
  incidents: IncidentRead[];
}

const EMPTY_RAW: RawData = {
  org: null,
  tools: [],
  toolsTotal: 0,
  activeAssignments: [],
  incidents: [],
};

export function useFleetStatusData(): FleetStatusData {
  const { userData } = useAuth();
  const [raw, setRaw] = useState<RawData>(EMPTY_RAW);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [org, toolsPage, activePage, incidentsPage] = await Promise.all([
        organizationsApi.getMyOrganization().catch(() => null),
        toolsApi.listTools({ page_size: TOOLS_PAGE_SIZE }),
        assignmentsApi.listAssignments({ status: 'active' }),
        incidentsApi.listIncidents(),
      ]);
      setRaw({
        org,
        tools: toolsPage.items,
        toolsTotal: toolsPage.total ?? toolsPage.items.length,
        activeAssignments: activePage.items,
        incidents: incidentsPage.items,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fleet status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = useMemo<Omit<FleetStatusData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const orgName = (raw.org?.name ?? userData?.organization?.name ?? '').toUpperCase();
    const initials = computeInitials(userData?.first_name, userData?.last_name, userData?.email);
    const total = raw.org?.tool_count ?? raw.toolsTotal;
    const inUse = raw.activeAssignments.length;
    const open = raw.incidents.filter((i) => !CLOSED_STATUSES.has(i.status));
    const maintenance = open.filter((i) => MAINTENANCE_TYPES.has(i.type)).length;
    // BACKEND_GAP: missing-status not directly tracked on tools — derived from incidents.
    const missingFromIncidents = open.filter((i) => MISSING_TYPES.has(i.type)).length;
    const available = Math.max(0, total - inUse - maintenance - missingFromIncidents);

    const tagsUsed = raw.tools.filter((t) => !!t.nfc_tag_id && t.nfc_tag_id.length > 0).length;
    // BACKEND_GAP: total NFC-tag inventory (issued tag pool) not exposed.
    const tagsTotal: number | null = null;
    const taggedPercent =
      total > 0 ? Math.round((tagsUsed / total) * 100) : null;

    const exceptions = buildExceptions(open);

    return {
      organizationName: orgName,
      userInitials: initials,
      hasUnreadAlerts: null,
      inventory: {
        total,
        available,
        inUse,
        maintenance,
        missing: missingFromIncidents,
        tagsUsed,
        tagsTotal,
        taggedPercent,
      },
      exceptions: exceptions.slice(0, 4),
      exceptionsTotal: exceptions.length,
    };
  }, [raw, userData]);

  return { ...data, isLoading, error, refresh: load };
}

function buildExceptions(openIncidents: IncidentRead[]): FleetException[] {
  // BACKEND_GAP: assignments lack due_date so "overdue assignment" exceptions are
  // not produced. Once the field ships, prepend overdue rows here.
  return openIncidents
    .map<FleetException>((i) => {
      const isMaint = MAINTENANCE_TYPES.has(i.type);
      const isDamage = DAMAGE_TYPES.has(i.type) || HIGH_SEVERITIES.has(i.severity);
      const kind: FleetException['kind'] = isMaint ? 'maintenance' : 'report';
      const ageLabel = formatAgeLabel(i.created_at);
      const detailLabel = isMaint
        ? truncateOneLine(i.description) || 'Service due'
        : truncateOneLine(i.description) || 'Open report';
      const severityColor: FleetException['severityColor'] =
        isDamage || HIGH_SEVERITIES.has(i.severity) ? 'red' : 'amber';
      return {
        id: `incident-${i.id}`,
        kind,
        toolId: i.tool_id,
        incidentId: i.id,
        toolName: i.tool_name || `Tool #${i.tool_id}`,
        ageLabel,
        detailLabel,
        severityColor,
      };
    })
    .sort(rankException);
}

function rankException(a: FleetException, b: FleetException): number {
  const colorRank = (c: FleetException['severityColor']) => (c === 'red' ? 0 : 1);
  if (colorRank(a.severityColor) !== colorRank(b.severityColor)) {
    return colorRank(a.severityColor) - colorRank(b.severityColor);
  }
  // older first within the same severity
  return 0;
}

function formatAgeLabel(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return '';
  const ms = Date.now() - created;
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function truncateOneLine(s: string | undefined | null, max = 28): string {
  if (!s) return '';
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
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

// BACKEND_GAP: dedicated GET /api/v1/fleet/exceptions/ endpoint would let the
// server prioritize across overdue + damage + maintenance signals and include
// assignee names ("Sylvia Williams") that are not currently joined into
// IncidentRead.
