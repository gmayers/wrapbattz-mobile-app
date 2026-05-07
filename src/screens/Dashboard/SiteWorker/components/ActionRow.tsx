import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActionButton from '../../shared/components/ActionButton';
import { palette } from '../../shared/palette';
import type { ActionRow as ActionRowData } from '../types';

interface Props {
  row: ActionRowData;
  onCtaPress: (row: ActionRowData) => void;
}

const ActionRow: React.FC<Props> = ({ row, onCtaPress }) => (
  <View style={styles.row}>
    <View style={styles.iconWrap}>
      <Ionicons name={row.iconName} size={18} color={row.iconTint ?? palette.textSecondary} />
    </View>
    <View style={styles.middle}>
      <Text style={styles.primary} numberOfLines={1}>{row.primary}</Text>
      <Text style={styles.secondary} numberOfLines={1}>{row.secondary}</Text>
    </View>
    <ActionButton kind={row.cta.kind} label={row.cta.label} onPress={() => onCtaPress(row)} />
  </View>
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
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1 },
  primary: { color: palette.textPrimary, fontSize: 14, fontWeight: '700' },
  secondary: { color: palette.textMuted, fontSize: 12, marginTop: 2 },
});

export default ActionRow;
