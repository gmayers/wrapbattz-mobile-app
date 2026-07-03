import { matchCategoryId, ADD_NEW_CATEGORY, resolveCategoryLabel } from '../../constants/deviceCategories';

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

describe('resolveCategoryLabel', () => {
  it('returns the picked fixed category as-is', () => {
    expect(resolveCategoryLabel('Tool', 'ignored')).toBe('Tool');
  });
  it('returns the trimmed custom name when Add new is selected', () => {
    expect(resolveCategoryLabel(ADD_NEW_CATEGORY, '  PPE  ')).toBe('PPE');
  });
  it('returns empty string when Add new is selected but no name typed', () => {
    expect(resolveCategoryLabel(ADD_NEW_CATEGORY, '   ')).toBe('');
  });
});
