import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../palette';

export interface QuickActionItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  onPress: () => void;
}

interface Props {
  items: QuickActionItem[];
}

const QuickActions: React.FC<Props> = ({ items }) => {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.tile, item.primary ? styles.tilePrimary : styles.tileGhost]}
          onPress={item.onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Ionicons
            name={item.icon}
            size={22}
            color={item.primary ? '#1B1300' : palette.textPrimary}
          />
          <Text
            style={[
              styles.label,
              { color: item.primary ? '#1B1300' : palette.textPrimary },
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
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
  tilePrimary: {
    backgroundColor: palette.amber,
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
