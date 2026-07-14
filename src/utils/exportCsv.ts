export interface Column { key: string; label: string; }

function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], cols: Column[]): string {
  const header = cols.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(',')).join('\r\n');
  return body ? `${header}\r\n${body}` : header;
}

export async function shareCsv(filename: string, rows: Record<string, unknown>[], cols: Column[]): Promise<void> {
  // Required lazily: expo-sharing resolves its native module at import time,
  // and app binaries older than versionCode 8 don't ship it. A top-level
  // import crashes the whole OTA bundle on those builds (expo-updates then
  // silently rolls back to the embedded JS), so the miss must be contained
  // to this feature.
  let FileSystem: typeof import('expo-file-system/legacy');
  let Sharing: typeof import('expo-sharing');
  try {
    FileSystem = require('expo-file-system/legacy');
    Sharing = require('expo-sharing');
  } catch {
    throw new Error('Exporting is not available in this version of the app. Please update from the store.');
  }
  const csv = toCsv(rows, cols);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
}
