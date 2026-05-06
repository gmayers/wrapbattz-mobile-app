import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, PLACEHOLDER_DASH } from '../../shared/palette';
import type { InventoryStats } from '../types';

interface Props {
  data: InventoryStats;
}

const formatNum = (n: number | null): string =>
  n === null || n === undefined ? PLACEHOLDER_DASH : String(n);

const InventoryCard: React.FC<Props> = ({ data }) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>INVENTORY</Text>
        <Text style={styles.summary}>
          {formatNum(data.devices)} DEVICES · {formatNum(data.tags)} TAGS
        </Text>
      </View>
      <View style={styles.statsRow}>
        <Stat value={data.available} label="AVAIL." color={palette.green} />
        <Stat value={data.inUse} label="IN USE" color={palette.amber} />
        <Stat value={data.maintenance} label="MAINT." color={palette.orange} />
        <Stat value={data.overdue} label="OVERDUE" color={palette.red} />
      </View>
    </View>
  );
};

const Stat: React.FC<{ value: number | null; label: string; color: string }> = ({
  value,
  label,
  color,
}) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, { color: value === null ? palette.placeholder : color }]}>
      {formatNum(value)}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heading: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  summary: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});

export default InventoryCard;
