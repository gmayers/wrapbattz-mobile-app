import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  sites as sitesApi,
  vans as vansApi,
  assignments as assignmentsApi,
  siteAssignments as siteAssignmentsApi,
  members as membersApi,
} from '../../../api/endpoints';
import type { AssignmentRead, MemberRead, SiteAssignmentRead } from '../../../api/types';
import { computeInitials } from '../../Dashboard/shared/identity';
import type { LocationKind } from '../../Dashboard/shared/components/KindBadge';

export interface UserRow {
  memberId: number;
  initials: string;
  name: string;
  metaPrimary: string;
  toolCount: number;
}

export interface ToolRow {
  toolId: number;
  name: string;
  identifier: string;
  status?: string;
  assigneeName?: string;
}

export interface LocationDetailData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;
  kind: LocationKind;
  name: string;
  code: string;
  users: UserRow[];
  tools: ToolRow[];
}

export function useLocationDetail(id: number, kind: LocationKind): LocationDetailData {
  const [meta, setMeta] = useState<{ name: string; code: string }>({ name: '', code: '' });
  const [assignments, setAssignments] = useState<AssignmentRead[]>([]);
  const [siteAssignments, setSiteAssignments] = useState<SiteAssignmentRead[]>([]);
  const [members, setMembers] = useState<MemberRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const metaPromise = kind === 'vehicle'
        ? vansApi.getVan(id).then((v) => ({ name: v.name, code: v.prefix_code || v.nickname || '' }))
        : sitesApi.getSite(id).then((s) => ({ name: s.name, code: s.prefix_code || s.nickname || '' }));

      const [m, a, sa, mp] = await Promise.all([
        metaPromise,
        // BACKEND_GAP: vans don't have a dedicated list-assignments endpoint;
        // listAssignmentsBySite for kind=vehicle may return empty until backend ships it.
        assignmentsApi.listAssignmentsBySite(id).catch(() => ({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 })),
        kind === 'vehicle'
          ? Promise.resolve({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 })
          : siteAssignmentsApi.listSiteAssignments({ site: id }).catch(() => ({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 })),
        membersApi.listMembers(),
      ]);

      setMeta(m);
      setAssignments(a.items);
      setSiteAssignments(sa.items);
      setMembers(mp.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load location');
    } finally {
      setIsLoading(false);
    }
  }, [id, kind]);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<LocationDetailData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const memberByUserId = new Map<number, MemberRead>();
    for (const m of members) memberByUserId.set(m.user_id, m);

    const toolCountByUser = new Map<number, number>();
    for (const a of assignments) {
      if (a.assignee_user_id == null) continue;
      toolCountByUser.set(a.assignee_user_id, (toolCountByUser.get(a.assignee_user_id) ?? 0) + 1);
    }

    const userIds = new Set<number>();
    for (const a of assignments) {
      if (a.assignee_user_id != null) userIds.add(a.assignee_user_id);
    }
    for (const sa of siteAssignments) {
      if (sa.is_active) userIds.add(sa.user_id);
    }

    const users: UserRow[] = Array.from(userIds).map((uid) => {
      const m = memberByUserId.get(uid);
      const name = m ? `${m.first_name} ${m.last_name}`.trim() || m.email : `User #${uid}`;
      const sa = siteAssignments.find((s) => s.user_id === uid && s.is_active);
      return {
        memberId: uid,
        initials: m ? computeInitials(m.first_name, m.last_name, m.email) : '?',
        name,
        metaPrimary: sa?.role || (m ? roleLabel(m.role) : ''),
        toolCount: toolCountByUser.get(uid) ?? 0,
      };
    });

    const tools: ToolRow[] = assignments.map((a) => {
      const m = a.assignee_user_id != null ? memberByUserId.get(a.assignee_user_id) : undefined;
      const assigneeName = m ? `${m.first_name} ${m.last_name}`.trim() || m.email : a.assignee_user_email || undefined;
      return {
        toolId: a.tool_id,
        name: a.tool_name || `Tool #${a.tool_id}`,
        identifier: `#${a.tool_id}`,
        status: a.status,
        assigneeName,
      };
    });

    return { kind, name: meta.name, code: meta.code, users, tools };
  }, [assignments, siteAssignments, members, meta, kind]);

  return { ...data, isLoading, error, refresh: load };
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    office_worker: 'Office worker',
    site_worker: 'Site worker',
    admin: 'Admin',
    owner: 'Owner',
  };
  return map[role] ?? role.replace(/_/g, ' ');
}
