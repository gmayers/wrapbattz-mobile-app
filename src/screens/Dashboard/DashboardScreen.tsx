import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { quickActionsForRole, QuickAction } from './quickActions';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useScanTag } from '../../hooks/useScanTag';
import { useUnreadCount } from '../../notifications/queries';
import QuickActionsGrid from './components/QuickActionsGrid';
import DataOverview from './components/DataOverview';
import ControlRoomScreen from './ControlRoom/ControlRoomScreen';
import FleetStatusScreen from './FleetStatus/FleetStatusScreen';

const DashboardScreen: React.FC = () => {
  const { userData } = useAuth();
  const role = userData?.role as any;

  if (role === 'owner') {
    return <ControlRoomScreen />;
  }
  if (role === 'admin') {
    return <FleetStatusScreen />;
  }
  return <StandardDashboard role={role} />;
};

const StandardDashboard: React.FC<{ role: any }> = ({ role }) => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const actions = quickActionsForRole(role);
  const stats = useDashboardStats(role);
  const { scan } = useScanTag();
  const { count: unread } = useUnreadCount();

  const handleAction = (a: QuickAction) => {
    if (a.onPressType === 'scan') {
      scan();
      return;
    }
    if (a.destination) navigation.navigate(a.destination, a.params);
  };

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? 'View alerts, unread' : 'View alerts'}
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
          {unread > 0 ? <View style={[styles.bellDot, { backgroundColor: colors.primary }]} /> : null}
        </TouchableOpacity>
      </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bell: { padding: 6 },
  bellDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4 },
});

export default DashboardScreen;
