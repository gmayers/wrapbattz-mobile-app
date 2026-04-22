import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import type { ToolItem } from '../hooks/useMyTools';

interface Props {
  item: ToolItem;
  onPress: (item: ToolItem) => void;
}

const STATUS_COLOR: Record<ToolItem['status'], 'primary' | 'success' | 'error' | 'warning'> = {
  assigned: 'primary',
  available: 'success',
  missing: 'error',
  maintenance: 'warning',
};

const ToolsListItem: React.FC<Props> = ({ item, onPress }) => {
  const { colors } = useTheme();
  const chipColor = colors[STATUS_COLOR[item.status]];
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.info}>
        <Text style={[styles.identifier, { color: colors.textPrimary }]}>{item.identifier}</Text>
        {item.toolType ? <Text style={[styles.type, { color: colors.textSecondary }]}>{item.toolType}</Text> : null}
      </View>
      <View style={[styles.statusChip, { backgroundColor: chipColor + '22', borderColor: chipColor }]}>
        <Text style={[styles.statusText, { color: chipColor }]}>{item.status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  info: { flex: 1 },
  identifier: { fontSize: 15, fontWeight: '600' },
  type: { fontSize: 12, marginTop: 2 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, marginRight: 8 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});

export default ToolsListItem;
