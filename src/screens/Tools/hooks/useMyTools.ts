import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as assignmentsApi from '../../../api/endpoints/assignments';
import * as toolsApi from '../../../api/endpoints/tools';
import { ApiError } from '../../../api/errors';
import type { AssignmentRead, ToolRead } from '../../../api/types';

export interface ToolItem {
  id: string;
  identifier: string;
  toolType?: string;
  status: 'assigned' | 'available' | 'missing' | 'maintenance';
}

export interface SiteGroup {
  siteId: string;
  siteName: string;
  siteType: 'location' | 'van' | 'toolbox';
  tools: ToolItem[];
}

export interface UseMyToolsResult {
  isLoading: boolean;
  groups: SiteGroup[];
  filter: 'mine' | 'all';
  setFilter: (f: 'mine' | 'all') => void;
  error: string | null;
  refresh: () => void;
}

const MINE_GROUP_ID = '__mine__';
const ALL_GROUP_ID = '__all__';

function mapToolStatus(raw: string | undefined): ToolItem['status'] {
  const v = (raw || '').toLowerCase();
  if (v.includes('assign')) return 'assigned';
  if (v.includes('miss') || v.includes('lost') || v.includes('stolen')) return 'missing';
  if (v.includes('maint') || v.includes('repair')) return 'maintenance';
  return 'available';
}

function groupMine(assignments: AssignmentRead[]): SiteGroup[] {
  if (assignments.length === 0) return [];
  const tools: ToolItem[] = assignments.map((a) => ({
    id: String(a.tool_id),
    identifier: a.tool_name,
    toolType: a.assignee_site_name || undefined,
    status: 'assigned',
  }));
  return [
    {
      siteId: MINE_GROUP_ID,
      siteName: 'Assigned to you',
      siteType: 'toolbox',
      tools,
    },
  ];
}

function groupAll(tools: ToolRead[]): SiteGroup[] {
  if (tools.length === 0) return [];
  const items: ToolItem[] = tools.map((t) => ({
    id: String(t.id),
    identifier: t.name,
    toolType: t.category_name || [t.make, t.model].filter(Boolean).join(' ') || undefined,
    status: mapToolStatus(t.status),
  }));
  return [
    {
      siteId: ALL_GROUP_ID,
      siteName: 'All organization tools',
      siteType: 'location',
      tools: items,
    },
  ];
}

export function useMyTools(initialFilter: 'mine' | 'all' = 'mine'): UseMyToolsResult {
  const [filter, setFilter] = useState<'mine' | 'all'>(initialFilter);
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<SiteGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (filter === 'mine') {
          const mine = await assignmentsApi.listMyActiveAssignments();
          if (!cancelled) setGroups(groupMine(mine));
        } else {
          const page = await toolsApi.listTools({ page_size: 200 });
          if (!cancelled) setGroups(groupAll(page.items));
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'unauthorized') return;
        setGroups([]);
        setError(
          (err instanceof ApiError && err.message) ||
            'Could not load tools. Please try again.'
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { isLoading, groups, filter, setFilter, error, refresh };
}
