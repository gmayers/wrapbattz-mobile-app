import { computeInventory } from '@/screens/Dashboard/FleetStatus/hooks/donutTotals';

it('total is never less than in-use even when tool list is empty', () => {
  const r = computeInventory({ toolCount: null, toolsTotal: 0, inUse: 17, maintenance: 0, missing: 0 });
  expect(r.total).toBe(17);
  expect(r.available).toBe(0);
  expect(r.inUse).toBe(17);
});
it('uses the largest known total', () => {
  const r = computeInventory({ toolCount: 20, toolsTotal: 19, inUse: 17, maintenance: 1, missing: 0 });
  expect(r.total).toBe(20);
  expect(r.available).toBe(2);
});
it('available never negative', () => {
  const r = computeInventory({ toolCount: 5, toolsTotal: 5, inUse: 4, maintenance: 3, missing: 2 });
  expect(r.available).toBe(0);
});
