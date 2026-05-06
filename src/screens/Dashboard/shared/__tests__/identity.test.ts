import { computeInitials, colourFromName } from '../identity';

describe('computeInitials', () => {
  it('uses first letter of each of first+last when both present', () => {
    expect(computeInitials('Wendy', 'Jones')).toBe('WJ');
  });
  it('uppercases the result', () => {
    expect(computeInitials('wendy', 'jones')).toBe('WJ');
  });
  it('falls back to first letter of first name when no last', () => {
    expect(computeInitials('Wendy', '')).toBe('W');
  });
  it('falls back to email first letter when no name parts', () => {
    expect(computeInitials('', '', 'sylvia@example.com')).toBe('S');
  });
  it('returns "?" when nothing is provided', () => {
    expect(computeInitials('', '', '')).toBe('?');
  });
  it('handles null/undefined inputs', () => {
    expect(computeInitials(null, undefined, null)).toBe('?');
  });
});

describe('colourFromName', () => {
  it('returns a hex string', () => {
    expect(colourFromName('Wendy Jones')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
  it('is deterministic for the same input', () => {
    expect(colourFromName('Wendy Jones')).toBe(colourFromName('Wendy Jones'));
  });
  it('returns different colours for different names', () => {
    const a = colourFromName('Wendy Jones');
    const b = colourFromName('Sylvia Williams');
    expect(a).not.toBe(b);
  });
  it('handles empty string without crashing', () => {
    expect(colourFromName('')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
