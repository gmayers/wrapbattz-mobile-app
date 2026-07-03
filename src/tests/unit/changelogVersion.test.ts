import { isNewer } from '@/hooks/useWhatsNew';

it('detects newer versions', () => {
  expect(isNewer('1.4.0', '1.3.0')).toBe(true);
  expect(isNewer('1.4.1', '1.4.0')).toBe(true);
  expect(isNewer('1.4.0', '1.4.0')).toBe(false);
  expect(isNewer('1.3.0', '1.4.0')).toBe(false);
  expect(isNewer('1.4.0', null)).toBe(true);
});
