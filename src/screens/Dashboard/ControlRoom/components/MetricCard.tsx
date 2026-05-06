import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, PLACEHOLDER_DASH } from '../../shared/palette';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  heading: string;
  primary: string | number | null;
  primaryColor?: string;
  primarySuffix?: string;
  lines: (string | null)[];
  footerLabel: string;
  footerColor?: string;
  onFooterPress?: () => void;
}

const formatPrimary = (v: string | number | null, suffix?: string): string => {
  if (v === null || v === undefined) return PLACEHOLDER_DASH;
  return suffix ? `${v}${suffix}` : String(v);
};

const MetricCard: React.FC<Props> = ({
  icon,
  iconColor = palette.textMuted,
  heading,
  primary,
  primaryColor = palette.textPrimary,
  primarySuffix,
  lines,
  footerLabel,
  footerColor = palette.amber,
  onFooterPress,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Ionicons name={icon} size={14} color={iconColor} />
        <Text style={styles.heading}>{heading}</Text>
      </View>
      <Text
        style={[
          styles.primary,
          { color: primary === null ? palette.placeholder : primaryColor },
        ]}
        numberOfLines={1}
      >
        {formatPrimary(primary, primarySuffix)}
      </Text>
      <View style={styles.lines}>
        {lines.map((line, idx) => (
          <Text key={idx} style={styles.line} numberOfLines={1}>
            {line ?? PLACEHOLDER_DASH}
          </Text>
        ))}
      </View>
      <TouchableOpacity
        style={styles.footer}
        onPress={onFooterPress}
        disabled={!onFooterPress}
        accessibilityRole="button"
        accessibilityLabel={footerLabel}
        activeOpacity={0.7}
      >
        <Text style={[styles.footerLabel, { color: footerColor }]}>{footerLabel}</Text>
        <Ionicons name="chevron-forward" size={14} color={footerColor} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
    padding: 14,
    minHeight: 170,
    justifyContent: 'space-between',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  primary: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  lines: { marginTop: 6, gap: 2 },
  line: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.divider,
    paddingTop: 10,
    marginTop: 12,
  },
  footerLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default MetricCard;
