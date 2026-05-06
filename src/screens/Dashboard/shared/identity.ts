const PALETTE = [
  '#F97316', // orange
  '#22C55E', // green
  '#58A6FF', // blue
  '#FFC72C', // amber
  '#A78BFA', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F85149', // red
];

export function computeInitials(
  first?: string | null,
  last?: string | null,
  email?: string | null,
): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f || l) {
    const a = f ? f[0] : '';
    const b = l ? l[0] : '';
    const out = (a + b).toUpperCase();
    return out || '?';
  }
  const e = (email ?? '').trim();
  return e ? e[0].toUpperCase() : '?';
}

export function colourFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
