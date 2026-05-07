import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { palette } from '../../shared/palette';
import { useAccent } from '../../../../theme/AccentContext';

export interface FilterChipItem<K extends string = string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  items: FilterChipItem<K>[];
  value: K;
  onChange: (key: K) => void;
}

function FilterChips<K extends string>({ items, value, onChange }: Props<K>) {
  const accent = useAccent();
  const activeChipStyle = { backgroundColor: accent.bg, borderColor: accent.fg };
  const activeLabelStyle = { color: accent.fg };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.chip, active && activeChipStyle]}
            onPress={() => active || onChange(item.key)}
            accessibilityRole="radio"
            accessibilityLabel={`${item.label} filter`}
            accessibilityState={{ selected: active }}
            activeOpacity={0.85}
          >
            <Text style={[styles.label, active && [styles.labelActive, activeLabelStyle]]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  labelActive: { fontWeight: '700' },
});

export default FilterChips;
