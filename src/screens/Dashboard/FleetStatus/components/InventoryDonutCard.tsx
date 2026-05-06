import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, PLACEHOLDER_DASH } from '../../shared/palette';
import type { FleetInventory } from '../types';

interface Props {
  data: FleetInventory;
}

const RING_SIZE = 124;
const RING_THICKNESS = 9;

const InventoryDonutCard: React.FC<Props> = ({ data }) => {
  const ringColor = pickRingColor(data);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.ringWrap}>
          <View
            style={[
              styles.ring,
              {
                borderColor: ringColor,
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: RING_SIZE / 2,
                borderWidth: RING_THICKNESS,
              },
            ]}
          />
          <View style={styles.ringCenter}>
            <Text style={styles.ringCount}>{data.total}</Text>
            <Text style={styles.ringLabel}>DEVICES</Text>
          </View>
        </View>

        <View style={styles.statList}>
          <StatRow color={palette.green} label="Available" value={data.available} />
          <StatRow color={palette.amber} label="In use" value={data.inUse} />
          <StatRow color={palette.orange} label="Maint." value={data.maintenance} />
          <StatRow color={palette.red} label="Missing" value={data.missing} />
          <View style={styles.divider} />
          <StatRow
            color={palette.textFaint}
            label="Tags used"
            value={null}
            valueOverride={
              data.tagsTotal !== null
                ? `${data.tagsUsed}/${data.tagsTotal}`
                : `${data.tagsUsed}/${PLACEHOLDER_DASH}`
            }
          />
        </View>
      </View>
    </View>
  );
};

function pickRingColor(data: FleetInventory): string {
  if (data.missing && data.missing > 0) return palette.red;
  if (data.maintenance > 0) return palette.orange;
  if (data.inUse > data.available) return palette.amber;
  return palette.green;
}

const StatRow: React.FC<{
  color: string;
  label: string;
  value: number | null;
  valueOverride?: string;
}> = ({ color, label, value, valueOverride }) => (
  <View style={styles.statRow}>
    <View style={[styles.statDot, { backgroundColor: color }]} />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>
      {valueOverride ?? (value === null || value === undefined ? PLACEHOLDER_DASH : value)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute' },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringCount: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  ringLabel: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginTop: 2,
  },
  statList: { flex: 1, paddingLeft: 18 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 10,
  },
  statLabel: {
    flex: 1,
    color: palette.textSecondary,
    fontSize: 14,
  },
  statValue: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.divider,
    marginVertical: 6,
  },
});

export default InventoryDonutCard;
