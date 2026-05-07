import { palette } from './palette';

export type ActionKind = 'return' | 'report' | 'request' | 'log' | 'scan' | 'neutral';

interface ActionColour { fg: string; bg: string; ink: string; }

const NEUTRAL_INK = '#FFFFFF';
const RETURN_INK = '#1B1300';
const REPORT_INK = '#26120B';
const REQUEST_INK = '#001229';

export const actionColours: Record<ActionKind, ActionColour> = {
  return:  { fg: palette.amber,         bg: palette.amberSoft,    ink: RETURN_INK  },
  report:  { fg: palette.orange,        bg: palette.orangeSoft,   ink: REPORT_INK  },
  request: { fg: palette.blue,          bg: palette.blueSoft,     ink: REQUEST_INK },
  log:     { fg: palette.textSecondary, bg: palette.card,         ink: NEUTRAL_INK },
  scan:    { fg: palette.amber,         bg: palette.amberSoft,    ink: RETURN_INK  },
  neutral: { fg: palette.textPrimary,   bg: palette.card,         ink: NEUTRAL_INK },
};
