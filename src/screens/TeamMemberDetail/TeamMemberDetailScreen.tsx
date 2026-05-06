import React, { useLayoutEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import ToolCard from '../Dashboard/shared/components/ToolCard';
import { palette } from '../Dashboard/shared/palette';
import { colourFromName } from '../Dashboard/shared/identity';
import { useTeamMemberDetail } from './hooks/useTeamMemberDetail';

type Params = { memberId: number };

const TeamMemberDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: Params }, 'params'>>();
  const { memberId } = route.params;
  const data = useTeamMemberDetail(memberId);

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: data.name || 'Team member' });
  }, [navigation, data.name]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={data.isLoading} onRefresh={data.refresh} tintColor={palette.amber} />
        }
      >
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: data.name ? colourFromName(data.name) : palette.placeholder }]}>
            <Text style={styles.avatarText}>{data.initials}</Text>
          </View>
          <Text style={styles.name}>{data.name}</Text>
          <Text style={styles.role}>{data.role}</Text>
          {data.email ? <Text style={styles.email}>{data.email}</Text> : null}
        </View>

        <View style={styles.headingRow}>
          <Text style={styles.heading}>ASSIGNED TOOLS</Text>
          <Text style={styles.headingRight}>{data.tools.length}</Text>
        </View>

        {data.isLoading && data.tools.length === 0 ? (
          <View style={styles.loader}><ActivityIndicator color={palette.amber} /></View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        {data.tools.length === 0 && !data.isLoading ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No tools currently assigned</Text></View>
        ) : (
          data.tools.map((t) => (
            <ToolCard
              key={t.toolId}
              name={t.name}
              identifier={t.identifier}
              status={t.status}
              onPress={() => navigation.navigate('DeviceDetails', { deviceId: t.toolId })}
            />
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
  profile: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#1B1300', fontSize: 22, fontWeight: '800' },
  name: { color: palette.textPrimary, fontSize: 22, fontWeight: '700' },
  role: { color: palette.textSecondary, fontSize: 13, marginTop: 4 },
  email: { color: palette.textMuted, fontSize: 12, marginTop: 4 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  heading: { color: palette.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  headingRight: { color: palette.textMuted, fontSize: 12 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: { color: palette.red, fontSize: 12, paddingHorizontal: 18, paddingVertical: 6 },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default TeamMemberDetailScreen;
