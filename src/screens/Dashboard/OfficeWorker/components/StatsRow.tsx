import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, PLACEHOLDER_DASH } from '../../shared/palette';

export interface StatItem {
  label: string;
  value: number | null;
}

interface Props {
  stats: StatItem[];
}

const StatsRow: React.FC<Props> = ({ stats }) => (
  <View style={styles.row}>
    {stats.map((s, idx) => (
      <View key={s.label} style={[styles.cell, idx > 0 && styles.cellBorder]}>
        <Text style={styles.label}>{s.label}</Text>
        <Text style={styles.value}>{s.value == null ? PLACEHOLDER_DASH : String(s.value)}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: palette.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  cell: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  cellBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.divider },
  label: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 4,
  },
  value: { color: palette.textPrimary, fontSize: 22, fontWeight: '700' },
});

export default StatsRow;
