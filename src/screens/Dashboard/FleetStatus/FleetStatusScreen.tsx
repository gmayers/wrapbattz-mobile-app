import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFleetStatusData } from './hooks/useFleetStatusData';
import DashboardHeader from '../shared/components/DashboardHeader';
import QuickActions, { QuickActionItem } from '../shared/components/QuickActions';
import InventoryDonutCard from './components/InventoryDonutCard';
import ExceptionRow from './components/ExceptionRow';
import { palette, PLACEHOLDER_DASH } from '../shared/palette';
import type { FleetException } from './types';

const FleetStatusScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const data = useFleetStatusData();

  const subtitle = buildSubtitle(data.inventory.total, data.inventory.taggedPercent);
  const tagline = data.organizationName
    ? `${data.organizationName} / ADMIN`
    : 'YOUR ORGANIZATION / ADMIN';

  const quickActions: QuickActionItem[] = useMemo(
    () => [
      {
        key: 'addDevice',
        label: 'Add device',
        icon: 'add',
        primary: true,
        onPress: () => navigation.navigate('AddDevice'),
      },
      {
        key: 'printTags',
        label: 'Print tags',
        icon: 'pricetag-outline',
        // BACKEND_GAP: no print-tags flow yet — routes to AllDevices for picking.
        onPress: () => navigation.navigate('AllDevices'),
      },
      {
        key: 'logMaint',
        label: 'Log maint.',
        icon: 'construct-outline',
        onPress: () => navigation.navigate('CreateReport'),
      },
      {
        key: 'export',
        label: 'Export',
        icon: 'download-outline',
        // BACKEND_GAP: no export endpoint yet.
        onPress: () => navigation.navigate('AllReports'),
      },
    ],
    [navigation],
  );

  const handleException = (item: FleetException) => {
    if (item.incidentId !== undefined) {
      navigation.navigate('ReportDetails', { id: item.incidentId });
      return;
    }
    if (item.toolId !== undefined) {
      navigation.navigate('DeviceDetails', { id: item.toolId });
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={data.isLoading && data.inventory.total > 0}
            onRefresh={data.refresh}
            tintColor={palette.amber}
          />
        }
      >
        <DashboardHeader
          tagline={tagline}
          title="Fleet status"
          subtitle={subtitle}
          initials={data.userInitials}
          hasUnreadAlerts={data.hasUnreadAlerts}
          onAlertsPress={() => navigation.navigate('NotificationPreferences')}
          onAvatarPress={() => navigation.navigate('settings')}
        />

        <QuickActions items={quickActions} />

        {data.isLoading && data.inventory.total === 0 ? (
          <View style={styles.loader}>
            <ActivityIndicator color={palette.amber} />
          </View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        <InventoryDonutCard data={data.inventory} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            TOP EXCEPTIONS{' · '}
            <Text style={styles.sectionCount}>
              {data.exceptionsTotal === null ? PLACEHOLDER_DASH : data.exceptionsTotal}
            </Text>
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AllReports')}
            accessibilityRole="button"
            accessibilityLabel="View all exceptions"
          >
            <Text style={styles.sectionLink}>View all →</Text>
          </TouchableOpacity>
        </View>

        {data.exceptions.length === 0 && !data.isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No exceptions. Fleet is healthy.</Text>
          </View>
        ) : null}

        {data.exceptions.map((ex) => (
          <ExceptionRow key={ex.id} item={ex} onAction={handleException} />
        ))}
      </ScrollView>
    </View>
  );
};

function buildSubtitle(total: number, taggedPercent: number | null): string {
  const left = `${total} ${total === 1 ? 'device' : 'devices'}`;
  if (taggedPercent === null) return left;
  return `${left} · ${taggedPercent}% tagged`;
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  sectionCount: {
    color: palette.textPrimary,
    fontWeight: '800',
  },
  sectionLink: {
    color: palette.amber,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default FleetStatusScreen;
