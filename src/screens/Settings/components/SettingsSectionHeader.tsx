import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';

const SettingsSectionHeader: React.FC<{ title: string }> = ({ title }) => {
  const { colors } = useTheme();
  if (!title) return null;
  return <Text style={[styles.title, { color: colors.textSecondary, backgroundColor: colors.background }]}>{title.toUpperCase()}</Text>;
};

const styles = StyleSheet.create({
  title: { fontSize: 12, fontWeight: '700', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, letterSpacing: 0.5 },
});

export default SettingsSectionHeader;
