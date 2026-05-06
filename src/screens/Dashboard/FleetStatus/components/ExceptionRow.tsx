import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../shared/palette';
import type { FleetException } from '../types';

interface Props {
  item: FleetException;
  onAction: (item: FleetException) => void;
}

const KIND_LABELS: Record<FleetException['kind'], string> = {
  overdue: 'Overdue',
  report: 'Report',
  maintenance: 'Maint.',
};

const ACTION_FOR_KIND: Record<
  FleetException['kind'],
  { label: string; icon: keyof typeof Ionicons.glyphMap; tone: 'red' | 'green' | 'amber' }
> = {
  overdue: { label: 'Chase', icon: 'arrow-forward', tone: 'red' },
  report: { label: 'Review', icon: 'create-outline', tone: 'amber' },
  maintenance: { label: 'Log', icon: 'checkmark', tone: 'green' },
};

const TONE_COLORS = {
  red: { bg: palette.redSoft, fg: palette.red },
  green: { bg: 'rgba(34, 197, 94, 0.14)', fg: palette.green },
  amber: { bg: palette.amberSoft, fg: palette.amber },
};

const ExceptionRow: React.FC<Props> = ({ item, onAction }) => {
  const dotColor = item.severityColor === 'red' ? palette.red : palette.amber;
  const action = ACTION_FOR_KIND[item.kind];
  const tone = TONE_COLORS[action.tone];
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.toolName}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {KIND_LABELS[item.kind]} · {item.ageLabel || '—'}
          {item.detailLabel ? ` · ${item.detailLabel}` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: tone.bg }]}
        onPress={() => onAction(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${action.label} ${item.toolName}`}
      >
        <Ionicons name={action.icon} size={14} color={tone.fg} />
        <Text style={[styles.actionLabel, { color: tone.fg }]}>{action.label}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.divider,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  body: { flex: 1, paddingRight: 10 },
  name: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  sub: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ExceptionRow;
