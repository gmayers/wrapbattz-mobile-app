import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../palette';

interface Props {
  tagline: string;
  title: string;
  subtitle: string;
  initials: string;
  hasUnreadAlerts: boolean | null;
  onAlertsPress: () => void;
  onAvatarPress: () => void;
}

const DashboardHeader: React.FC<Props> = ({
  tagline,
  title,
  subtitle,
  initials,
  hasUnreadAlerts,
  onAlertsPress,
  onAvatarPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.orgRow}>
          <View style={styles.dot} />
          <Text style={styles.orgName} numberOfLines={1}>
            {tagline}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.right}>
        <TouchableOpacity
          style={styles.bellWrap}
          onPress={onAlertsPress}
          accessibilityRole="button"
          accessibilityLabel="View alerts"
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color={palette.textSecondary} />
          {hasUnreadAlerts ? <View style={styles.bellDot} /> : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.avatar}
          onPress={onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          activeOpacity={0.85}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  left: { flex: 1, paddingRight: 12 },
  orgRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.textMuted,
    marginRight: 8,
  },
  orgName: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
  },
  bellWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.red,
    borderWidth: 1.5,
    borderColor: palette.background,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#1B1300',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

export default DashboardHeader;
