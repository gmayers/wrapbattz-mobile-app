import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { quickActionsForRole, QuickAction } from './quickActions';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useScanTag } from '../../hooks/useScanTag';
import QuickActionsGrid from './components/QuickActionsGrid';
import DataOverview from './components/DataOverview';

const DashboardScreen: React.FC = () => {
  const { userData } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const role = userData?.role as any;
  const actions = quickActionsForRole(role);
  const stats = useDashboardStats(role);
  const { scan } = useScanTag();

  const handleAction = (a: QuickAction) => {
    if (a.onPressType === 'scan') {
      scan();
      return;
    }
    if (a.destination) navigation.navigate(a.destination);
  };

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
      <QuickActionsGrid actions={actions} onActionPress={handleAction} />
      <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>Overview</Text>
      <DataOverview stats={stats} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
});

export default DashboardScreen;
