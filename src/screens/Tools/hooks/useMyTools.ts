import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as assignmentsApi from '../../../api/endpoints/assignments';
import * as toolsApi from '../../../api/endpoints/tools';
import { ApiError } from '../../../api/errors';
import type { AssignmentRead, ToolRead } from '../../../api/types';
import { enrichLastHeld } from './lastHeld';

export interface ToolItem {
  id: string;
  identifier: string;
  toolType?: string;
  serial?: string;
  holderLabel?: string;
  siteHeld?: boolean;
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
  hasLoadedOnce: boolean;
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
  const tools: ToolItem[] = assignments.map((a) => {
    const holder =
      a.assignee_user_id != null
        ? `👤 ${a.assignee_user_email || 'Assigned'}`
        : a.assignee_site_id != null
          ? `📍 ${a.assignee_site_name || 'Location'}`
          : 'Available';
    return {
      id: String(a.tool_id),
      identifier: a.tool_name,
      toolType: undefined,
      holderLabel: holder,
      siteHeld: a.assignee_user_id == null && a.assignee_site_id != null,
      status: 'assigned',
    };
  });
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
    serial: t.serial_number || undefined,
    holderLabel: t.is_available ? 'Available' : 'In use',
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

  // In-flight guard: useFocusEffect fires refresh() on every tab return (and on
  // mount, alongside the initial load). Skip while a load is already running so
  // focus events don't stack extra requests.
  const inFlightRef = useRef(false);

  // Track whether we've completed at least one successful load so the empty
  // state is not shown while the first request is still in flight.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (filter === 'mine') {
          const mine = await assignmentsApi.listMyActiveAssignments();
          if (!cancelled) {
            setHasLoadedOnce(true);
            const initialGroups = groupMine(mine);
            setGroups(initialGroups);
            // Fire-and-forget: enrich location-held tools with "last held by <user>".
            const siteHeldIds = initialGroups
              .flatMap((g) => g.tools)
              .filter((t) => t.siteHeld)
              .map((t) => Number(t.id));
            if (siteHeldIds.length > 0) {
              void enrichLastHeld(
                siteHeldIds,
                (id) => toolsApi.getToolHistory(id),
                (id, name) => {
                  if (!name || cancelled) return;
                  setGroups((prev) =>
                    prev.map((g) => ({
                      ...g,
                      tools: g.tools.map((t) =>
                        Number(t.id) === id && t.siteHeld && !/last held by/.test(t.holderLabel ?? '')
                          ? { ...t, holderLabel: `${t.holderLabel} · last held by ${name}` }
                          : t
                      ),
                    }))
                  );
                },
              ).catch(() => {});
            }
          }
        } else {
          const page = await toolsApi.listTools({ page_size: 200 });
          if (!cancelled) {
            setHasLoadedOnce(true);
            setGroups(groupAll(page.items));
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'unauthorized') return;
        // Do NOT clear groups on error — keep the previously-loaded list so
        // a mid-flight focus refresh doesn't cause an empty-state flicker.
        setError(
          (err instanceof ApiError && err.message) ||
            'Could not load tools. Please try again.'
        );
      } finally {
        inFlightRef.current = false;
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
      if (inFlightRef.current) return;
      refresh();
    }, [refresh])
  );

  return { isLoading, hasLoadedOnce, groups, filter, setFilter, error, refresh };
}
