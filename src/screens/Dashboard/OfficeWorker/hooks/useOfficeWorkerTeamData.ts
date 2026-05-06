import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  members as membersApi,
  assignments as assignmentsApi,
  siteAssignments as siteAssignmentsApi,
  organizations as organizationsApi,
} from '../../../../api/endpoints';
import type {
  AssignmentRead,
  MemberRead,
  OrganizationRead,
  SiteAssignmentRead,
} from '../../../../api/types';
import { useAuth } from '../../../../context/AuthContext';
import { computeInitials } from '../../shared/identity';
import type { MemberRow, TeamData } from '../types';

interface RawData {
  org: OrganizationRead | null;
  members: MemberRead[];
  activeAssignments: AssignmentRead[];
  siteAssignments: SiteAssignmentRead[];
}

const EMPTY: RawData = { org: null, members: [], activeAssignments: [], siteAssignments: [] };

const ROLE_LABEL: Record<string, string> = {
  office_worker: 'Office worker',
  site_worker: 'Site worker',
  admin: 'Admin',
  owner: 'Owner',
};

function humanRole(role: string): string {
  return ROLE_LABEL[role] ?? role.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function useOfficeWorkerTeamData(): TeamData {
  const { userData } = useAuth();
  const [raw, setRaw] = useState<RawData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [org, membersPage, activePage, siteAssignmentsPage] = await Promise.all([
        organizationsApi.getMyOrganization().catch(() => null),
        membersApi.listMembers(),
        assignmentsApi.listAssignments({ status: 'active' }),
        siteAssignmentsApi.listSiteAssignments().catch(() => ({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 })),
      ]);
      setRaw({
        org,
        members: membersPage.items,
        activeAssignments: activePage.items,
        siteAssignments: siteAssignmentsPage.items,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<TeamData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const orgName = (raw.org?.name ?? userData?.organization?.name ?? '').toUpperCase();
    const userInitials = computeInitials(userData?.first_name, userData?.last_name, userData?.email);

    const toolCountByUser = new Map<number, number>();
    for (const a of raw.activeAssignments) {
      if (a.assignee_user_id == null) continue;
      toolCountByUser.set(a.assignee_user_id, (toolCountByUser.get(a.assignee_user_id) ?? 0) + 1);
    }

    const siteAssignmentByUser = new Map<number, SiteAssignmentRead>();
    for (const sa of raw.siteAssignments) {
      if (!sa.is_active) continue;
      const existing = siteAssignmentByUser.get(sa.user_id);
      if (!existing) siteAssignmentByUser.set(sa.user_id, sa);
    }

    const members: MemberRow[] = raw.members.map((m) => {
      const sa = siteAssignmentByUser.get(m.user_id);
      const fullName = `${m.first_name} ${m.last_name}`.trim() || m.email;
      const metaPrimary = sa
        ? `${sa.site_name}${sa.role ? ` · ${sa.role}` : ''}`
        : humanRole(m.role);
      return {
        memberId: m.user_id,
        initials: computeInitials(m.first_name, m.last_name, m.email),
        name: fullName,
        metaPrimary,
        metaSecondary: undefined, // BACKEND_GAP: no last-scan timestamp
        toolCount: toolCountByUser.get(m.user_id) ?? 0,
      };
    });

    return {
      organizationName: orgName,
      userInitials,
      hasUnreadAlerts: null,
      totalMembers: raw.members.length,
      totalToolsOut: raw.activeAssignments.length,
      onSite: null,    // BACKEND_GAP: no presence
      hq: null,        // BACKEND_GAP: no presence
      members,
    };
  }, [raw, userData]);

  return { ...data, isLoading, error, refresh: load };
}
