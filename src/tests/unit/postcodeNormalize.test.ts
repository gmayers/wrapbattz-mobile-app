const { normalizePostcode } = require('@/utils/CommonUtils');

it('uppercases and trims', () => {
  expect(normalizePostcode(' sw1a 1aa ')).toBe('SW1A 1AA');
});
it('collapses internal whitespace', () => {
  expect(normalizePostcode('EC1A   1BB')).toBe('EC1A 1BB');
});
it('passes through valid uppercase', () => {
  expect(normalizePostcode('EC1A 1BB')).toBe('EC1A 1BB');
});
it('handles null/undefined safely', () => {
  expect(normalizePostcode(null)).toBe('');
  expect(normalizePostcode(undefined)).toBe('');
});
