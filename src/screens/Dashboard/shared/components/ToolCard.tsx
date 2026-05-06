import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../palette';
import StatusPill, { StatusTone } from './StatusPill';

interface Props {
  name: string;
  identifier: string;
  status?: string;
  assigneeName?: string;
  onPress: () => void;
}

function statusTone(s?: string): StatusTone {
  if (!s) return 'muted';
  const lower = s.toLowerCase();
  if (lower === 'active') return 'green';
  if (lower === 'maintenance' || lower === 'maintenance_due') return 'amber';
  if (lower === 'missing' || lower === 'lost' || lower === 'stolen') return 'red';
  return 'muted';
}

const ToolCard: React.FC<Props> = ({ name, identifier, status, assigneeName, onPress }) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={name}
    activeOpacity={0.85}
  >
    <View style={styles.iconWrap}>
      <Ionicons name="construct-outline" size={20} color={palette.textSecondary} />
    </View>
    <View style={styles.middle}>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <Text style={styles.id} numberOfLines={1}>{identifier}</Text>
      {assigneeName ? (
        <Text style={styles.assignee} numberOfLines={1}>Assigned to <Text>{assigneeName}</Text></Text>
      ) : null}
    </View>
    <View style={styles.right}>
      {status ? <StatusPill label={status} tone={statusTone(status)} /> : null}
      <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1 },
  name: { color: palette.textPrimary, fontSize: 14, fontWeight: '700' },
  id: { color: palette.textMuted, fontSize: 12, marginTop: 2 },
  assignee: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export default ToolCard;
