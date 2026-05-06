import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  members as membersApi,
  assignments as assignmentsApi,
} from '../../../api/endpoints';
import type { AssignmentRead, MemberRead } from '../../../api/types';
import { computeInitials } from '../../Dashboard/shared/identity';

export interface MemberToolRow {
  toolId: number;
  name: string;
  identifier: string;
  status?: string;
}

export interface TeamMemberDetailData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;
  initials: string;
  name: string;
  email: string;
  role: string;
  tools: MemberToolRow[];
}

const ROLE_LABEL: Record<string, string> = {
  office_worker: 'Office worker',
  site_worker: 'Site worker',
  admin: 'Admin',
  owner: 'Owner',
};

export function useTeamMemberDetail(memberId: number): TeamMemberDetailData {
  const [member, setMember] = useState<MemberRead | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [m, a] = await Promise.all([
        membersApi.getMember(memberId),
        assignmentsApi.listAssignments({ status: 'active', user: memberId }),
      ]);
      setMember(m);
      setAssignments(a.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team member');
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const data = useMemo<Omit<TeamMemberDetailData, 'isLoading' | 'error' | 'refresh'>>(() => {
    const name = member ? `${member.first_name} ${member.last_name}`.trim() || member.email : '';
    return {
      initials: member ? computeInitials(member.first_name, member.last_name, member.email) : '?',
      name,
      email: member?.email ?? '',
      role: member ? (ROLE_LABEL[member.role] ?? member.role.replace(/_/g, ' ')) : '',
      tools: assignments.map((a) => ({
        toolId: a.tool_id,
        name: a.tool_name || `Tool #${a.tool_id}`,
        identifier: `#${a.tool_id}`,
        status: a.status,
      })),
    };
  }, [member, assignments]);

  return { ...data, isLoading, error, refresh: load };
}
