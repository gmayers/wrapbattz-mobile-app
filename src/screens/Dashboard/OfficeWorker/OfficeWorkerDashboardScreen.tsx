import React, { useMemo, useState } from 'react';
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
import SegmentedTabs, { SegmentedValue } from './components/SegmentedTabs';
import WhereTab from './tabs/WhereTab';
import TeamRosterTab from './tabs/TeamRosterTab';
import { palette } from '../shared/palette';
import { useOfficeWorkerWhereData } from './hooks/useOfficeWorkerWhereData';
import { useOfficeWorkerTeamData } from './hooks/useOfficeWorkerTeamData';
import { useScanTag } from '../../../hooks/useScanTag';

const OfficeWorkerDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const where = useOfficeWorkerWhereData();
  const team = useOfficeWorkerTeamData();
  const [tab, setTab] = useState<SegmentedValue>('left');
  const { scan } = useScanTag();

  const isLeft = tab === 'left';

  const tagline = isLeft
    ? `${where.organizationName || 'YOUR ORGANIZATION'} / OFFICE`
    : `${team.organizationName || 'YOUR ORGANIZATION'} / OFFICE`;
  const title = isLeft ? "Where's everything?" : 'Team roster';
  const subtitle = isLeft
    ? buildWhereSubtitle(where.counts)
    : `${team.totalMembers} ${team.totalMembers === 1 ? 'member' : 'members'} · ${team.totalToolsOut} tools out`;

  const quickActions: QuickActionItem[] = useMemo(
    () => isLeft
      ? [
          { key: 'place', label: 'Place tool', icon: 'add', primary: true, onPress: () => scan() },
          { key: 'move',  label: 'Move',       icon: 'swap-horizontal-outline', onPress: () => scan() },
          { key: 'assign',label: 'Assign',     icon: 'person-outline',          onPress: () => navigation.navigate('AllDevices') },
          // BACKEND_GAP: no export endpoint — routes to AllReports for now.
          { key: 'export',label: 'Export',     icon: 'download-outline',        onPress: () => navigation.navigate('AllReports') },
        ]
      : [
          { key: 'assign',label: 'Assign',     icon: 'person-outline', primary: true, onPress: () => navigation.navigate('AllDevices') },
          // BACKEND_GAP: no export endpoint — routes to AllReports for now.
          { key: 'export',label: 'Export',     icon: 'download-outline',                onPress: () => navigation.navigate('AllReports') },
        ],
    [isLeft, navigation, scan],
  );

  const isFirstLoad = isLeft
    ? where.isLoading && where.locations.length === 0
    : team.isLoading && team.members.length === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLeft ? where.isLoading : team.isLoading}
            onRefresh={isLeft ? where.refresh : team.refresh}
            tintColor={palette.amber}
          />
        }
      >
        <DashboardHeader
          tagline={tagline}
          title={title}
          subtitle={subtitle}
          initials={isLeft ? where.userInitials : team.userInitials}
          hasUnreadAlerts={isLeft ? where.hasUnreadAlerts : team.hasUnreadAlerts}
          onAlertsPress={() => navigation.navigate('NotificationPreferences')}
          onAvatarPress={() => navigation.navigate('settings')}
        />
        <QuickActions items={quickActions} />
        <SegmentedTabs left="Where" right="Team" value={tab} onChange={setTab} />

        {isFirstLoad ? (
          <View style={styles.loader}><ActivityIndicator color={palette.amber} /></View>
        ) : null}
        {(isLeft ? where.error : team.error) ? (
          <Text style={styles.errorText}>{isLeft ? where.error : team.error}</Text>
        ) : null}

        {isLeft ? (
          <WhereTab
            locations={where.locations}
            totalToolsPlaced={where.totalToolsPlaced}
            pendingApprovals={where.pendingApprovals}
            returnsDue={where.returnsDue}
            onLocationPress={(loc) => navigation.navigate('LocationDetail', { id: loc.id, kind: loc.kind })}
            onReview={() => navigation.navigate('NotificationPreferences')}
          />
        ) : (
          <TeamRosterTab
            members={team.members}
            totalMembers={team.totalMembers}
            totalToolsOut={team.totalToolsOut}
            onSite={team.onSite}
            hq={team.hq}
            onMemberPress={(memberId) => navigation.navigate('TeamMemberDetail', { memberId })}
          />
        )}
      </ScrollView>
    </View>
  );
};

function buildWhereSubtitle(counts: { sites: number; vehicles: number; toolboxes: number }): string {
  const parts: string[] = [];
  if (counts.sites > 0) parts.push(`${counts.sites} site${counts.sites === 1 ? '' : 's'}`);
  if (counts.vehicles > 0) parts.push(`${counts.vehicles} vehicle${counts.vehicles === 1 ? '' : 's'}`);
  if (counts.toolboxes > 0) parts.push(`${counts.toolboxes} toolbox${counts.toolboxes === 1 ? '' : 'es'}`);
  return parts.length === 0 ? 'No locations yet' : parts.join(' · ');
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
});

export default OfficeWorkerDashboardScreen;
