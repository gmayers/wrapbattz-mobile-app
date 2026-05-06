import React, { useLayoutEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import SegmentedTabs, { SegmentedValue } from '../Dashboard/OfficeWorker/components/SegmentedTabs';
import MemberCard from '../Dashboard/shared/components/MemberCard';
import ToolCard from '../Dashboard/shared/components/ToolCard';
import KindBadge from '../Dashboard/shared/components/KindBadge';
import { palette } from '../Dashboard/shared/palette';
import { useLocationDetail } from './hooks/useLocationDetail';
import type { LocationKind } from '../Dashboard/shared/components/KindBadge';

type Params = { id: number; kind: LocationKind };

const LocationDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: Params }, 'params'>>();
  const { id, kind } = route.params;
  const data = useLocationDetail(id, kind);
  const [tab, setTab] = useState<SegmentedValue>('left');

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: data.name || 'Location' });
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
        <View style={styles.header}>
          <KindBadge kind={data.kind} />
          <Text style={styles.title} numberOfLines={1}>{data.name}</Text>
          <Text style={styles.code} numberOfLines={1}>{data.code}</Text>
        </View>

        <SegmentedTabs left="Users" right="Tools" value={tab} onChange={setTab} />

        {data.isLoading && data.users.length === 0 && data.tools.length === 0 ? (
          <View style={styles.loader}><ActivityIndicator color={palette.amber} /></View>
        ) : null}
        {data.error ? <Text style={styles.errorText}>{data.error}</Text> : null}

        {tab === 'left' ? (
          data.users.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No one assigned tools here</Text></View>
          ) : (
            data.users.map((u) => (
              <MemberCard
                key={u.memberId}
                initials={u.initials}
                name={u.name}
                metaPrimary={u.metaPrimary}
                toolCount={u.toolCount}
                onViewPress={() => navigation.navigate('TeamMemberDetail', { memberId: u.memberId })}
              />
            ))
          )
        ) : (
          data.tools.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No tools here yet</Text></View>
          ) : (
            data.tools.map((t) => (
              <ToolCard
                key={t.toolId}
                name={t.name}
                identifier={t.identifier}
                status={t.status}
                assigneeName={t.assigneeName}
                onPress={() => navigation.navigate('DeviceDetails', { id: t.toolId })}
              />
            ))
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 28, paddingTop: 6 },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  title: { color: palette.textPrimary, fontSize: 26, fontWeight: '700', marginTop: 6 },
  code: { color: palette.textMuted, fontSize: 13, marginTop: 2, marginBottom: 12 },
  loader: { paddingVertical: 18, alignItems: 'center' },
  errorText: { color: palette.red, fontSize: 12, paddingHorizontal: 18, paddingVertical: 6 },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default LocationDetailScreen;
