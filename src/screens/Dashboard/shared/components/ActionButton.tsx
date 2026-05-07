import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../palette';
import { actionColours, ActionKind } from '../actionColours';

interface Props {
  kind: ActionKind;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'compact';
  onPress: () => void;
}

const ActionButton: React.FC<Props> = ({ kind, label, icon, variant = 'compact', onPress }) => {
  const colours = actionColours[kind];
  const isPrimary = variant === 'primary';
  const baseStyle = isPrimary ? styles.primary : styles.compact;
  const bg = isPrimary ? colours.fg : colours.bg;
  const fg = isPrimary ? colours.ink : colours.fg;
  return (
    <TouchableOpacity
      style={[baseStyle, { backgroundColor: bg }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.85}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={isPrimary ? 22 : 14} color={fg} />
        </View>
      ) : null}
      <Text style={[isPrimary ? styles.primaryLabel : styles.compactLabel, { color: fg }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primary: {
    flex: 1,
    height: 78,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  iconWrap: { },
  primaryLabel: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  compactLabel: { fontSize: 13, fontWeight: '600' },
});

export default ActionButton;
