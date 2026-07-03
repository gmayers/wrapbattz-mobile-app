import { matchCategoryId } from '../../constants/deviceCategories';

const backend = [
  { id: 1, name: 'Tool' },
  { id: 2, name: 'Equipment' },
  { id: 3, name: 'Gear' },
];

describe('matchCategoryId', () => {
  it('returns the id for an exact match', () => {
    expect(matchCategoryId('Equipment', backend)).toBe(2);
  });

  it('matches case-insensitively', () => {
    expect(matchCategoryId('GEAR', backend)).toBe(3);
  });

  it('returns null when no match exists', () => {
    expect(matchCategoryId('Vehicle/Plant', backend)).toBeNull();
  });

  it('returns null for an empty backend list', () => {
    expect(matchCategoryId('Tool', [])).toBeNull();
  });
});
