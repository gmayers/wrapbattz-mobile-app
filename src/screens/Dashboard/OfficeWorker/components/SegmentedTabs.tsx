import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { palette } from '../../shared/palette';

export type SegmentedValue = 'left' | 'right';

interface Props {
  left: string;
  right: string;
  value: SegmentedValue;
  onChange: (value: SegmentedValue) => void;
}

const SegmentedTabs: React.FC<Props> = ({ left, right, value, onChange }) => {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      <Tab label={left} active={value === 'left'} onPress={() => value !== 'left' && onChange('left')} />
      <Tab label={right} active={value === 'right'} onPress={() => value !== 'right' && onChange('right')} />
    </View>
  );
};

interface TabProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const Tab: React.FC<TabProps> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.tab, active && styles.tabActive]}
    onPress={onPress}
    accessibilityRole="tab"
    accessibilityLabel={`${label} tab`}
    accessibilityState={{ selected: active }}
    activeOpacity={0.85}
  >
    <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
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
  tabActive: {
    backgroundColor: palette.amber,
  },
  label: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: '#1B1300',
    fontWeight: '700',
  },
});

export default SegmentedTabs;
