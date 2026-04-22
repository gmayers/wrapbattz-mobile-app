import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';

type Mode = 'system' | 'light' | 'dark';

const ThemePickerRow: React.FC = () => {
  const { colors, themeMode, setThemeMode } = useTheme();
  const options: { key: Mode; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];
  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
      <View style={styles.header}>
        <Ionicons name="color-palette-outline" size={22} color={colors.textPrimary} />
        <Text style={[styles.label, { color: colors.textPrimary }]}>Theme</Text>
      </View>
      <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
        {options.map(o => {
          const active = themeMode === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.opt, active && { backgroundColor: colors.primary }]}
              onPress={() => setThemeMode(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.optText, { color: active ? (colors as any).onPrimary : colors.textSecondary }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { fontSize: 15, fontWeight: '500' },
  segmented: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  opt: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  optText: { fontSize: 13, fontWeight: '600' },
});

export default ThemePickerRow;
