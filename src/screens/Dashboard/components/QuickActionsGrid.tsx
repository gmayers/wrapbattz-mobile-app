import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import type { QuickAction } from '../quickActions';

interface Props {
  actions: QuickAction[];
  onActionPress: (action: QuickAction) => void;
}

const QuickActionsGrid: React.FC<Props> = ({ actions, onActionPress }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {actions.map(a => (
        <TouchableOpacity
          key={a.key}
          style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onActionPress(a)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          activeOpacity={0.7}
        >
          <Ionicons name={a.icon as any} size={28} color={colors.primary} />
          <Text style={[styles.label, { color: colors.textPrimary }]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  tile: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 88,
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center' },
});

export default QuickActionsGrid;
