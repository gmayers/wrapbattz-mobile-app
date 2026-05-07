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
import DashboardHeader from '../shared/components/DashboardHeader';
import QuickActions, { QuickActionItem } from '../shared/components/QuickActions';
import TodayLogCard from './components/TodayLogCard';
import ActionRow from './components/ActionRow';
import { palette } from '../shared/palette';
import { useAccent } from '../../../theme/AccentContext';
import { useSiteWorkerData } from './hooks/useSiteWorkerData';
import { useScanTag } from '../../../hooks/useScanTag';
import type { ActionRow as ActionRowData } from './types';

const SiteWorkerDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const accent = useAccent();
  const data = useSiteWorkerData();
  const { scan } = useScanTag();

  const quickActions: QuickActionItem[] = useMemo(
    () => [
      { key: 'return',  label: 'Return',   icon: 'arrow-undo-outline', primary: true,  actionKind: 'return',  onPress: () => scan() },
      { key: 'report',  label: 'Report',   icon: 'alert-circle-outline',                    onPress: () => navigation.navigate('CreateReport') },
      { key: 'request', label: 'Request',  icon: 'add-circle-outline',                      onPress: () => navigation.navigate('AllDevices') },
      { key: 'my',      label: 'My tools', icon: 'construct-outline',                       onPress: () => navigation.navigate('tools') },
    ],
    [navigation, scan],
  );

  const handleRowCta = (row: ActionRowData) => {
    if (row.kind === 'flagged' && row.payload.incidentId !== undefined) {
      navigation.navigate('ReportDetails', { id: row.payload.incidentId });
      return;
    }
    if ((row.kind === 'overdue' || row.kind === 'due_today') && row.payload.assignmentId !== undefined) {
      scan();
      return;
    }
    if (row.kind === 'eod') {
      scan();
    }
  };

  const isFirstLoad = data.isLoading && data.rows.length === 0 && data.checkedOut === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={data.isLoading} onRefresh={data.refresh} tintColor={accent.fg} />
        }
      >
        <DashboardHeader
          tagline={data.siteTagline}
          title="Your actions"
          subtitle="What needs your attention today"
          initials={data.userInitials}
          hasUnreadAlerts={data.hasUnreadAlerts}
          onAlertsPress={() => navigation.navigate('NotificationPreferences')}
          onAvatarPress={() => navigation.navigate('settings')}
        />
        <QuickActions items={quickActions} />
        <TodayLogCard
          checkedOut={data.checkedOut}
          returnedToday={data.returnedToday}
          overdueCount={data.overdueCount}
        />

        <View style={styles.headingRow}>
          <Text style={styles.heading}>NEEDS YOUR ACTION</Text>
          <Text style={styles.headingRight}>{data.rows.length}</Text>
        </View>

        {isFirstLoad ? (
          <View style={styles.loader}><ActivityIndicator color={accent.fg} /></View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        {data.rows.length === 0 && !data.isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>All caught up — nothing to action right now.</Text>
          </View>
        ) : (
          data.rows.map((row) => (
            <ActionRow key={row.id} row={row} onCtaPress={handleRowCta} />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 28, paddingTop: 6 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 6,
  },
  heading: { color: palette.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  headingRight: { color: palette.textMuted, fontSize: 12 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: { color: palette.red, fontSize: 12, paddingHorizontal: 18, paddingVertical: 6 },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default SiteWorkerDashboardScreen;
