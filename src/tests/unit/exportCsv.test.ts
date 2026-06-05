import { toCsv } from '@/utils/exportCsv';

it('builds csv with header and escaping', () => {
  const csv = toCsv(
    [{ name: 'Drill', note: 'has, comma' }, { name: 'Saw "X"', note: 'line\nbreak' }],
    [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note' }],
  );
  expect(csv).toBe('Name,Note\r\nDrill,"has, comma"\r\n"Saw ""X""","line\nbreak"');
});
it('header only when no rows', () => {
  expect(toCsv([], [{ key: 'a', label: 'A' }])).toBe('A');
});
