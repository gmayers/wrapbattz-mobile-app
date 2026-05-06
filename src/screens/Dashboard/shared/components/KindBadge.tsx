import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../palette';

export type LocationKind = 'site' | 'vehicle' | 'toolbox';

interface Props {
  kind: LocationKind;
}

const ICON: Record<LocationKind, keyof typeof Ionicons.glyphMap> = {
  site: 'location-outline',
  vehicle: 'car-outline',
  toolbox: 'cube-outline',
};

const LABEL: Record<LocationKind, string> = {
  site: 'SITE',
  vehicle: 'VEHICLE',
  toolbox: 'TOOLBOX',
};

const KindBadge: React.FC<Props> = ({ kind }) => (
  <View style={styles.row}>
    <Ionicons name={ICON[kind]} size={11} color={palette.textMuted} />
    <Text style={styles.label}>{LABEL[kind]}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
});

export default KindBadge;
