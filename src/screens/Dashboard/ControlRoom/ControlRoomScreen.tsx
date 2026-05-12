import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useControlRoomData } from './hooks/useControlRoomData';
import DashboardHeader from '../shared/components/DashboardHeader';
import QuickActions, { QuickActionItem } from '../shared/components/QuickActions';
import InventoryCard from './components/InventoryCard';
import MetricCard from './components/MetricCard';
import { palette, PLACEHOLDER_DASH } from '../shared/palette';

const ControlRoomScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const data = useControlRoomData();

  const quickActions: QuickActionItem[] = useMemo(
    () => [
      {
        key: 'add',
        label: 'Add',
        icon: 'add',
        primary: true,
        onPress: () => navigation.navigate('AddDevice'),
      },
      {
        key: 'audit',
        label: 'Audit',
        icon: 'document-text-outline',
        // BACKEND_GAP: no audit feature yet — routes to Reports screen for now.
        onPress: () => navigation.navigate('AllReports'),
      },
      {
        key: 'alerts',
        label: 'Alerts',
        icon: 'notifications-outline',
        onPress: () => navigation.navigate('NotificationPreferences'),
      },
      {
        key: 'report',
        label: 'Report',
        icon: 'bar-chart-outline',
        onPress: () => navigation.navigate('CreateReport'),
      },
    ],
    [navigation],
  );

  const sitesLines = useMemo(() => {
    if (data.sites.top.length === 0) return [PLACEHOLDER_DASH, PLACEHOLDER_DASH, PLACEHOLDER_DASH];
    const lines = data.sites.top.map((s) => `${s.prefixCode} · ${s.toolCount} tools`);
    while (lines.length < 3) lines.push('');
    return lines;
  }, [data.sites.top]);

  const memberRoleLine =
    data.members.total > 0
      ? `${data.members.admins} admin${data.members.admins === 1 ? '' : 's'} · ${data.members.workers} worker${data.members.workers === 1 ? '' : 's'}`
      : null;

  const attentionLines = [
    formatCount(data.attention.overdueReturns, 'overdue return', 'overdue returns'),
    formatCount(data.attention.criticalReports, 'critical report', 'critical reports'),
    formatCount(data.attention.maintenanceOverdue, 'maint. overdue', 'maint. overdue'),
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={data.isLoading && data.organizationName !== ''}
            onRefresh={data.refresh}
            tintColor={palette.amber}
          />
        }
      >
        <DashboardHeader
          tagline={data.organizationName || 'YOUR ORGANIZATION'}
          title="Control room"
          subtitle="All systems at a glance"
          initials={data.userInitials}
          hasUnreadAlerts={data.hasUnreadAlerts}
          onAlertsPress={() => navigation.navigate('NotificationPreferences')}
          onAvatarPress={() => navigation.navigate('settings')}
        />
        <QuickActions items={quickActions} />
        {data.isLoading && data.inventory.devices === 0 ? (
          <View style={styles.loader}>
            <ActivityIndicator color={palette.amber} />
          </View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        <InventoryCard data={data.inventory} />

        <View style={styles.gridRow}>
          <MetricCard
            icon="warning-outline"
            iconColor={palette.red}
            heading="ATTENTION"
            primary={data.attention.total}
            primaryColor={palette.red}
            lines={attentionLines}
            footerLabel="Resolve"
            footerColor={palette.red}
            onFooterPress={() => navigation.navigate('AllReports')}
          />
          <View style={styles.gridGap} />
          <MetricCard
            icon="business-outline"
            iconColor={palette.textSecondary}
            heading="SITES"
            primary={data.sites.total}
            lines={sitesLines}
            footerLabel="View"
            onFooterPress={() => navigation.navigate('sites')}
          />
        </View>

        <View style={styles.gridRow}>
          <MetricCard
            icon="people-outline"
            iconColor={palette.textSecondary}
            heading="MEMBERS"
            primary={data.members.total}
            lines={[
              memberRoleLine,
              formatCount(data.members.scanningToday, 'scanning today', 'scanning today'),
              formatCount(data.members.idle, 'idle', 'idle'),
            ]}
            footerLabel="Manage"
            onFooterPress={() => navigation.navigate('Members')}
          />
          <View style={styles.gridGap} />
          <MetricCard
            icon="checkmark-circle-outline"
            iconColor={palette.green}
            heading="COMPLIANCE"
            primary={data.compliance.percent}
            primaryColor={palette.textPrimary}
            primarySuffix={data.compliance.percent !== null ? '%' : undefined}
            lines={[
              formatCount(data.compliance.patTestsDue, 'PAT test due', 'PAT tests due'),
              formatCount(data.compliance.servicesOverdue, 'service overdue', 'services overdue'),
              formatCount(data.compliance.hiresEndingToday, 'hire ending today', 'hires ending today'),
            ]}
            footerLabel="Review"
            onFooterPress={() => navigation.navigate('AllReports')}
          />
        </View>
      </ScrollView>
    </View>
  );
};

function formatCount(
  n: number | null,
  singular: string,
  plural: string,
): string | null {
  if (n === null || n === undefined) return null;
  return `${n} ${n === 1 ? singular : plural}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 28, paddingTop: 6 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: {
    color: palette.red,
    fontSize: 12,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  gridGap: { width: 12 },
});

export default ControlRoomScreen;
