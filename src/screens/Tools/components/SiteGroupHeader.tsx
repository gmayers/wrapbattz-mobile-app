import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import type { SiteGroup } from '../hooks/useMyTools';

const ICON: Record<SiteGroup['siteType'], string> = {
  location: '📍',
  van: '🚐',
  toolbox: '🧰',
};

const SiteGroupHeader: React.FC<{ group: SiteGroup }> = ({ group }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {ICON[group.siteType]}  {group.siteName}
      </Text>
      <Text style={[styles.count, { color: colors.textSecondary }]}>{group.tools.length} tools</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 12 },
});

export default SiteGroupHeader;
