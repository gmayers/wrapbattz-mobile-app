import { palette } from './palette';

const PALETTE = [
  palette.orange,
  palette.green,
  palette.blue,
  palette.amber,
  palette.violet,
  palette.pink,
  palette.teal,
  palette.red,
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
