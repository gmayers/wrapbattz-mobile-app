export const DEVICE_CATEGORIES = ['Tool', 'Equipment', 'Gear', 'Vehicle/Plant', 'Materials'] as const;
export type DeviceCategory = typeof DEVICE_CATEGORIES[number];

// Match a fixed label to an existing backend category id (case-insensitive) if present.
export function matchCategoryId(
  label: string,
  backend: { id: number; name: string }[],
): number | null {
  const hit = backend.find((c) => c.name.trim().toLowerCase() === label.trim().toLowerCase());
  return hit ? hit.id : null;
}
