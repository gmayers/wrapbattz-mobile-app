import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { palette } from '../../shared/palette';
import { useAccent } from '../../../../theme/AccentContext';

export type SegmentedValue = 'left' | 'right';

interface Props {
  left: string;
  right: string;
  value: SegmentedValue;
  onChange: (value: SegmentedValue) => void;
}

const SegmentedTabs: React.FC<Props> = ({ left, right, value, onChange }) => {
  const accent = useAccent();
  const activeBg = { backgroundColor: accent.fg };
  const activeInk = { color: accent.ink };
  return (
    <View style={styles.row} accessibilityRole="tablist">
      <Tab label={left}  active={value === 'left'}  activeBg={activeBg} activeInk={activeInk}
           onPress={() => value !== 'left'  && onChange('left')} />
      <Tab label={right} active={value === 'right'} activeBg={activeBg} activeInk={activeInk}
           onPress={() => value !== 'right' && onChange('right')} />
    </View>
  );
};

interface TabProps {
  label: string;
  active: boolean;
  activeBg: { backgroundColor: string };
  activeInk: { color: string };
  onPress: () => void;
}

const Tab: React.FC<TabProps> = ({ label, active, activeBg, activeInk, onPress }) => (
  <TouchableOpacity
    style={[styles.tab, active && activeBg]}
    onPress={onPress}
    accessibilityRole="tab"
    accessibilityLabel={`${label} tab`}
    accessibilityState={{ selected: active }}
    activeOpacity={0.85}
  >
    <Text style={[styles.label, active && [styles.labelActive, activeInk]]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  tab: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  label: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '700',
  },
});

export default SegmentedTabs;
