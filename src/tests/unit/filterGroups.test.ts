import { filterGroupsByQuery } from '@/screens/Tools/hooks/filterGroups';
import type { SiteGroup } from '@/screens/Tools/hooks/useMyTools';

const groups: SiteGroup[] = [
  {
    siteId: 'a', siteName: 'Depot', siteType: 'location',
    tools: [
      { id: '1', identifier: 'Makita Drill', toolType: 'Tool', serial: 'SN-001', status: 'available' },
      { id: '2', identifier: 'Ladder', toolType: 'Equipment', serial: 'SN-002', status: 'available' },
    ],
  },
  {
    siteId: 'b', siteName: 'Van 3', siteType: 'van',
    tools: [{ id: '3', identifier: 'Grinder', toolType: 'Tool', status: 'assigned' }],
  },
];

describe('filterGroupsByQuery', () => {
  it('returns groups unchanged for empty/whitespace query', () => {
    expect(filterGroupsByQuery(groups, '')).toBe(groups);
    expect(filterGroupsByQuery(groups, '   ')).toBe(groups);
  });

  it('matches identifier case-insensitively', () => {
    const out = filterGroupsByQuery(groups, 'makita');
    expect(out).toHaveLength(1);
    expect(out[0].tools.map(t => t.id)).toEqual(['1']);
  });

  it('matches serial and toolType', () => {
    expect(filterGroupsByQuery(groups, 'sn-002')[0].tools[0].id).toBe('2');
    expect(filterGroupsByQuery(groups, 'equipment')[0].tools[0].id).toBe('2');
  });

  it('drops groups with no matching tools', () => {
    const out = filterGroupsByQuery(groups, 'grinder');
    expect(out).toHaveLength(1);
    expect(out[0].siteId).toBe('b');
  });

  it('tolerates tools with missing optional fields', () => {
    expect(filterGroupsByQuery(groups, 'zzz-no-match')).toHaveLength(0);
  });
});
