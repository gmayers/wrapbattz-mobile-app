import { palette } from '../screens/Dashboard/shared/palette';

export type TabAccentKey = 'dashboard' | 'tools' | 'incidents' | 'sites' | 'settings';

export interface TabAccent {
  key: TabAccentKey;
  fg: string;
  bg: string;
  ink: string;
}

const AMBER_INK = '#1B1300';
const BLUE_INK = '#001229';
const ORANGE_INK = '#26120B';
const GREEN_INK = '#0B240F';
const VIOLET_INK = '#150E2A';

export const tabAccents: Record<TabAccentKey, TabAccent> = {
  dashboard: { key: 'dashboard', fg: palette.amber,  bg: palette.amberSoft,  ink: AMBER_INK  },
  tools:     { key: 'tools',     fg: palette.blue,   bg: palette.blueSoft,   ink: BLUE_INK   },
  incidents: { key: 'incidents', fg: palette.orange, bg: palette.orangeSoft, ink: ORANGE_INK },
  sites:     { key: 'sites',     fg: palette.green,  bg: palette.greenSoft,  ink: GREEN_INK  },
  settings:  { key: 'settings',  fg: palette.violet, bg: palette.violetSoft, ink: VIOLET_INK },
};

const KNOWN_KEYS = new Set<string>(Object.keys(tabAccents));

export function isTabAccentKey(value: unknown): value is TabAccentKey {
  return typeof value === 'string' && KNOWN_KEYS.has(value);
}
