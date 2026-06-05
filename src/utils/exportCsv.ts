import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
  const csv = toCsv(rows, cols);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
}
