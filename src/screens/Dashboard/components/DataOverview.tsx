import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import type { DashboardStats } from '../hooks/useDashboardStats';

interface Props {
  stats: DashboardStats;
}

const DataOverview: React.FC<Props> = ({ stats }) => {
  const { colors } = useTheme();
  if (stats.isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.card }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading stats…</Text>
      </View>
    );
  }
  if (stats.role === 'worker' && stats.worker) {
    return (
      <View style={styles.row}>
        <StatChip label="Tools" value={stats.worker.toolsAssigned} />
        <StatChip label="Incidents" value={stats.worker.openIncidents} />
        <StatChip label="Sites" value={stats.worker.sites} />
      </View>
    );
  }
  if (stats.role === 'admin' && stats.admin) {
    return (
      <View style={styles.grid}>
        <StatCard label="Active Tools" value={stats.admin.activeTools} />
        <StatCard label="In Use" value={stats.admin.inUse} />
        <StatCard label="Missing" value={stats.admin.missing} tone="danger" />
        <StatCard label="Maintenance Due" value={stats.admin.maintenanceDue} tone="warning" />
      </View>
    );
  }
  return null;
};

const StatChip: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.card }]}>
      <Text style={[styles.chipValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const StatCard: React.FC<{ label: string; value: number; tone?: 'danger' | 'warning' }> = ({ label, value, tone }) => {
  const { colors } = useTheme();
  const valueColor =
    tone === 'danger' ? colors.error :
    tone === 'warning' ? colors.warning :
    colors.primary;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.cardValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  loader: { padding: 20, alignItems: 'center', borderRadius: 10 },
  loadingText: { marginTop: 8, fontSize: 13 },
  row: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10 },
  chipValue: { fontSize: 20, fontWeight: '800' },
  chipLabel: { fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', padding: 16, borderRadius: 12 },
  cardValue: { fontSize: 28, fontWeight: '800' },
  cardLabel: { fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
});

export default DataOverview;
