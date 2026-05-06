import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { palette } from '../palette';
import { colourFromName } from '../identity';

interface Props {
  initials: string;
  initialsBg?: string;
  name: string;
  metaPrimary: string;
  metaSecondary?: string;
  toolCount: number;
  onViewPress?: () => void;
  presence?: 'online' | 'offline' | null;
}

const MemberCard: React.FC<Props> = ({
  initials,
  initialsBg,
  name,
  metaPrimary,
  metaSecondary,
  toolCount,
  onViewPress,
  presence,
}) => {
  const bg = initialsBg ?? colourFromName(name);
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text style={styles.avatarText}>{initials}</Text>
        {presence ? (
          <View style={[styles.presence, presence === 'online' ? styles.online : styles.offline]} />
        ) : null}
      </View>
      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.metaPrimary} numberOfLines={1}>
          {metaPrimary}
        </Text>
        {metaSecondary ? (
          <Text style={styles.metaSecondary} numberOfLines={1}>
            {metaSecondary}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.count}>{toolCount}</Text>
        <Text style={styles.countLabel}>{toolCount === 1 ? 'tool' : 'tools'}</Text>
      </View>
      {onViewPress ? (
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={onViewPress}
          accessibilityRole="button"
          accessibilityLabel={`View ${name}`}
          activeOpacity={0.85}
        >
          <Text style={styles.viewText}>View</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#1B1300',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  presence: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.background,
  },
  online: { backgroundColor: palette.green },
  offline: { backgroundColor: palette.red },
  middle: { flex: 1 },
  name: { color: palette.textPrimary, fontSize: 15, fontWeight: '700' },
  metaPrimary: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  metaSecondary: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
  right: { alignItems: 'center', minWidth: 40 },
  count: { color: palette.textPrimary, fontSize: 18, fontWeight: '700' },
  countLabel: { color: palette.textMuted, fontSize: 10 },
  viewBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewText: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
});

export default MemberCard;
