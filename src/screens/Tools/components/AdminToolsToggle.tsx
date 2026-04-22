import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';

interface Props {
  value: 'mine' | 'all';
  onChange: (next: 'mine' | 'all') => void;
}

const AdminToolsToggle: React.FC<Props> = ({ value, onChange }) => {
  const { colors } = useTheme();
  const Option = (key: 'mine' | 'all', label: string) => {
    const active = value === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.opt, { backgroundColor: active ? colors.primary : 'transparent' }]}
        onPress={() => onChange(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.optText, { color: active ? (colors as any).onPrimary : colors.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      {Option('mine', 'My Tools')}
      {Option('all', 'All Org Tools')}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: 8, padding: 2, borderWidth: StyleSheet.hairlineWidth },
  opt: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  optText: { fontSize: 13, fontWeight: '600' },
});

export default AdminToolsToggle;
