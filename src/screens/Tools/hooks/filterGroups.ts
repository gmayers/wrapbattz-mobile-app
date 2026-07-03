import type { SiteGroup } from './useMyTools';

export function filterGroupsByQuery(groups: SiteGroup[], query: string): SiteGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      tools: g.tools.filter((t) =>
        [t.identifier, t.toolType, t.serial]
          .some((v) => (v ?? '').toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.tools.length > 0);
}
