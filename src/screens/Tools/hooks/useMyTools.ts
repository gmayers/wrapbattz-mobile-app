import { useState } from 'react';

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
}

export function useMyTools(): UseMyToolsResult {
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  return { isLoading: false, groups: [], filter, setFilter };
}
