import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../palette';
import { colourFromName } from '../identity';

interface Props {
  initials: string[];
  max?: number;
}

const InitialsChipStack: React.FC<Props> = ({ initials, max = 3 }) => {
  if (initials.length === 0) return null;
  const visible = initials.slice(0, max);
  const overflow = initials.length - visible.length;
  return (
    <View style={styles.row}>
      {visible.map((init, idx) => (
        <View
          key={`${init}-${idx}`}
          style={[
            styles.chip,
            { backgroundColor: colourFromName(init), marginLeft: idx === 0 ? 0 : -8 },
          ]}
        >
          <Text style={styles.text}>{init}</Text>
        </View>
      ))}
      {overflow > 0 ? (
        <View style={[styles.chip, styles.overflow, { marginLeft: -8 }]}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.card,
  },
  text: { color: '#1B1300', fontSize: 10, fontWeight: '800' },
  overflow: { backgroundColor: palette.placeholder },
  overflowText: { color: palette.textPrimary, fontSize: 10, fontWeight: '700' },
});

export default InitialsChipStack;
