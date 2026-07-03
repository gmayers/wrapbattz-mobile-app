import {
  conditionLabelFromScore,
  computeNextMaintenanceDate,
  toYMD,
} from '../../utils/toolMaintenance';

describe('conditionLabelFromScore', () => {
  it('returns OK when no score recorded', () => {
    expect(conditionLabelFromScore(null)).toBe('OK');
    expect(conditionLabelFromScore(undefined)).toBe('OK');
    expect(conditionLabelFromScore('')).toBe('OK');
  });

  it('maps numeric bands per backend lifecycle thresholds (≤4 low)', () => {
    expect(conditionLabelFromScore(9)).toBe('Good');
    expect(conditionLabelFromScore(7.1)).toBe('Good');
    expect(conditionLabelFromScore(7)).toBe('Fair');
    expect(conditionLabelFromScore(4.1)).toBe('Fair');
    expect(conditionLabelFromScore(4)).toBe('Poor');
    expect(conditionLabelFromScore('2.5')).toBe('Poor');
  });

  it('returns OK for unparseable input', () => {
    expect(conditionLabelFromScore('not-a-number')).toBe('OK');
  });
});

describe('computeNextMaintenanceDate', () => {
  it('adds the interval in days', () => {
    const from = new Date(2026, 6, 3); // 2026-07-03 local
    expect(toYMD(computeNextMaintenanceDate(90, from))).toBe('2026-10-01');
  });

  it('rolls over month/year boundaries', () => {
    const from = new Date(2026, 11, 20); // 2026-12-20
    expect(toYMD(computeNextMaintenanceDate(30, from))).toBe('2027-01-19');
  });
});

describe('toYMD', () => {
  it('zero-pads month and day', () => {
    expect(toYMD(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
