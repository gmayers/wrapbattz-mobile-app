import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../palette';
import { useAccent } from '../../../../theme/AccentContext';
import { actionColours, ActionKind } from '../actionColours';

export interface QuickActionItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  actionKind?: ActionKind;
  onPress: () => void;
}

interface Props {
  items: QuickActionItem[];
}

const QuickActions: React.FC<Props> = ({ items }) => {
  const accent = useAccent();
  return (
    <View style={styles.row}>
      {items.map((item) => {
        const isPrimary = !!item.primary;
        const primaryColours = isPrimary
          ? (item.actionKind ? actionColours[item.actionKind] : { fg: accent.fg, ink: accent.ink })
          : null;
        const backgroundColor = primaryColours ? primaryColours.fg : palette.card;
        const ink = primaryColours ? primaryColours.ink : palette.textPrimary;
        return (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.tile,
              isPrimary
                ? { backgroundColor }
                : styles.tileGhost,
            ]}
            onPress={item.onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <Ionicons name={item.icon} size={22} color={ink} />
            <Text style={[styles.label, { color: ink }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  tile: {
    flex: 1,
    height: 78,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tileGhost: {
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
});

export default QuickActions;
