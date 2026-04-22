import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import type { SettingsRow as SettingsRowConfig } from '../sections';

interface Props {
  row: SettingsRowConfig;
  onPress: (row: SettingsRowConfig) => void;
}

const SettingsRow: React.FC<Props> = ({ row, onPress }) => {
  const { colors } = useTheme();
  const color = row.destructive ? colors.error : colors.textPrimary;
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}
      onPress={() => onPress(row)}
      accessibilityRole="button"
      accessibilityLabel={row.label}
      activeOpacity={0.7}
    >
      <Ionicons name={row.icon as any} size={22} color={color} />
      <Text style={[styles.label, { color }]}>{row.label}</Text>
      {row.kind === 'nav' ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 14 },
  label: { flex: 1, fontSize: 15, fontWeight: '500' },
});

export default SettingsRow;
