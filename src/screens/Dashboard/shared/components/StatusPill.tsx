import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../palette';

export type StatusTone = 'green' | 'amber' | 'red' | 'muted';

interface Props {
  label: string;
  tone: StatusTone;
}

const TONES: Record<StatusTone, { fg: string; bg: string }> = {
  green: { fg: palette.green, bg: palette.greenSoft },
  amber: { fg: palette.amber, bg: palette.amberSoft },
  red: { fg: palette.red, bg: palette.redSoft },
  muted: { fg: palette.textMuted, bg: palette.card },
};

const StatusPill: React.FC<Props> = ({ label, tone }) => {
  if (!label) return null;
  const palette_ = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette_.bg }]}>
      <Text style={[styles.label, { color: palette_.fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});

export default StatusPill;
