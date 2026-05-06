import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { palette } from '../palette';
import KindBadge, { LocationKind } from './KindBadge';
import InitialsChipStack from './InitialsChipStack';

interface Props {
  kind: LocationKind;
  name: string;
  code: string;
  toolCount: number;
  workerInitials: string[];
  hasUnread?: boolean;
  onPress: () => void;
}

const LocationCard: React.FC<Props> = ({
  kind,
  name,
  code,
  toolCount,
  workerInitials,
  hasUnread,
  onPress,
}) => {
  const toolsLabel = `${toolCount} ${toolCount === 1 ? 'tool' : 'tools'}`;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${toolsLabel}`}
      activeOpacity={0.85}
    >
      <View style={styles.topRow}>
        <KindBadge kind={kind} />
        {hasUnread ? <View style={styles.dot} /> : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.code} numberOfLines={1}>
        {code}
      </Text>
      <View style={styles.bottomRow}>
        <Text style={styles.count}>{toolsLabel}</Text>
        <InitialsChipStack initials={workerInitials} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
    minHeight: 140,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.green,
  },
  name: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  code: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LocationCard;
