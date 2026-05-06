import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DashboardHeader from '../Dashboard/shared/components/DashboardHeader';
import TeamRosterTab from '../Dashboard/OfficeWorker/tabs/TeamRosterTab';
import { palette } from '../Dashboard/shared/palette';
import { useOfficeWorkerTeamData } from '../Dashboard/OfficeWorker/hooks/useOfficeWorkerTeamData';

const TeamRosterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const data = useOfficeWorkerTeamData();
  const tagline = `${data.organizationName || 'YOUR ORGANIZATION'} / TEAM`;
  const subtitle = `${data.totalMembers} ${data.totalMembers === 1 ? 'member' : 'members'} · ${data.totalToolsOut} tools out`;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={data.isLoading} onRefresh={data.refresh} tintColor={palette.amber} />
        }
      >
        <DashboardHeader
          tagline={tagline}
          title="Team roster"
          subtitle={subtitle}
          initials={data.userInitials}
          hasUnreadAlerts={data.hasUnreadAlerts}
          onAlertsPress={() => navigation.navigate('NotificationPreferences')}
          onAvatarPress={() => navigation.navigate('settings')}
        />

        {data.isLoading && data.members.length === 0 ? (
          <View style={styles.loader}><ActivityIndicator color={palette.amber} /></View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        <TeamRosterTab
          members={data.members}
          totalMembers={data.totalMembers}
          totalToolsOut={data.totalToolsOut}
          onSite={data.onSite}
          hq={data.hq}
          onMemberPress={(memberId) => navigation.navigate('TeamMemberDetail', { memberId })}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 28, paddingTop: 6 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: { color: palette.red, fontSize: 12, paddingHorizontal: 18, paddingVertical: 6 },
});

export default TeamRosterScreen;
