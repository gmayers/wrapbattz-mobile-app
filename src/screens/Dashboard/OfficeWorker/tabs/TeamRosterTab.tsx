import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import StatsRow from '../components/StatsRow';
import MemberCard from '../../shared/components/MemberCard';
import { palette } from '../../shared/palette';
import type { MemberRow } from '../types';

interface Props {
  members: MemberRow[];
  totalMembers: number;
  totalToolsOut: number;
  onSite: number | null;
  hq: number | null;
  onMemberPress: (memberId: number) => void;
}

const TeamRosterTab: React.FC<Props> = ({
  members,
  totalMembers,
  totalToolsOut,
  onSite,
  hq,
  onMemberPress,
}) => (
  <View>
    <StatsRow stats={[
      { label: 'ON SITE',   value: onSite },
      { label: 'HQ',        value: hq },
      { label: 'TOOLS OUT', value: totalToolsOut },
    ]} />
    <View style={styles.headingRow}>
      <Text style={styles.heading}>WHO HAS WHAT</Text>
      <Text style={styles.headingRight}>{totalMembers} {totalMembers === 1 ? 'member' : 'members'}</Text>
    </View>
    {members.length === 0 ? (
      <View style={styles.empty}><Text style={styles.emptyText}>No teammates yet</Text></View>
    ) : (
      members.map((m) => (
        <MemberCard
          key={m.memberId}
          initials={m.initials}
          name={m.name}
          metaPrimary={m.metaPrimary}
          metaSecondary={m.metaSecondary}
          toolCount={m.toolCount}
          onViewPress={() => onMemberPress(m.memberId)}
        />
      ))
    )}
  </View>
);

const styles = StyleSheet.create({
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
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default TeamRosterTab;
