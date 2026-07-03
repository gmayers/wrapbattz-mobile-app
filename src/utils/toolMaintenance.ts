// Condition bands follow backend lifecycle.py: condition_score is 1.0–10.0
// and ≤4 raises the "low condition" replacement flag. A tool with no
// recorded score is presumed fine ("OK") rather than shown as a dash.
export function conditionLabelFromScore(
  score: number | string | null | undefined,
): string {
  if (score == null || score === '') return 'OK';
  const n = Number(score);
  if (Number.isNaN(n)) return 'OK';
  if (n > 7) return 'Good';
  if (n > 4) return 'Fair';
  return 'Poor';
}

export function computeNextMaintenanceDate(
  intervalDays: number,
  from: Date = new Date(),
): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + intervalDays);
  return d;
}

export function toYMD(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Single source for the next-maintenance value: prefers the canonical
// next_maintenance_date, falling back to the old next_maintenance key still
// found in stale NFC-tag payloads.
export function resolveNextMaintenanceDate(
  device:
    | { next_maintenance_date?: string | null; next_maintenance?: string | null }
    | null
    | undefined,
): string | null {
  if (!device) return null;
  return device.next_maintenance_date || device.next_maintenance || null;
}
