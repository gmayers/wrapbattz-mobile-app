export const DEVICE_CATEGORIES = ['Tool', 'Equipment', 'Gear', 'Vehicle/Plant', 'Materials'] as const;
export type DeviceCategory = typeof DEVICE_CATEGORIES[number];

// Sentinel dropdown value for the "+ Add new…" option (not a real category).
export const ADD_NEW_CATEGORY = '__add_new__';

// The effective category label to submit: the picked fixed label, or the
// user-typed custom name when "+ Add new…" is selected.
export function resolveCategoryLabel(picked: string, customName: string): string {
  return picked === ADD_NEW_CATEGORY ? customName.trim() : picked;
}

// Match a fixed label to an existing backend category id (case-insensitive) if present.
export function matchCategoryId(
  label: string,
  backend: { id: number; name: string }[],
): number | null {
  const hit = backend.find((c) => c.name.trim().toLowerCase() === label.trim().toLowerCase());
  return hit ? hit.id : null;
}
