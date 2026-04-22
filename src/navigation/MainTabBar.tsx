import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { tabsForRole, TabConfig } from './mainTabs';

interface Props extends BottomTabBarProps {
  onScanPress: () => void;
}

const MainTabBar: React.FC<Props> = ({ state, navigation, insets, onScanPress }) => {
  const { colors } = useTheme();
  const { userData } = useAuth();
  const tabs = tabsForRole(userData?.role as any);

  const renderRegularTab = (tab: TabConfig, routeIndex: number) => {
    const focused = state.routes[routeIndex]?.name === tab.key && state.index === routeIndex;
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes[routeIndex]?.key,
        canPreventDefault: true,
      } as any);
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(tab.key);
      }
    };
    const tint = focused ? colors.primary : colors.textMuted;
    return (
      <TouchableOpacity
        key={tab.key}
        style={styles.tab}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: focused }}
        activeOpacity={0.7}
      >
        <Ionicons name={(focused ? tab.iconFocused : tab.icon) as any} size={24} color={tint} />
        <Text style={[styles.label, { color: tint }]}>{tab.label}</Text>
      </TouchableOpacity>
    );
  };

  const renderFab = (tab: TabConfig) => (
    <View key={tab.key} style={styles.fabSlot}>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={onScanPress}
        accessibilityRole="button"
        accessibilityLabel="Scan NFC tag"
        accessibilityHint="Starts the NFC reader to scan a tool"
        activeOpacity={0.85}
      >
        <Ionicons name={tab.iconFocused as any} size={30} color={(colors as any).onPrimary ?? '#0F1722'} />
      </TouchableOpacity>
      <Text style={[styles.fabLabel, { color: colors.primary }]}>{tab.label}</Text>
    </View>
  );

  let routeIndex = 0;
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10),
          height: (Platform.OS === 'ios' ? 80 : 64) + insets.bottom,
        },
      ]}
    >
      {tabs.map(tab => {
        if (tab.isFab) return renderFab(tab);
        return renderRegularTab(tab, routeIndex++);
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 10,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -20,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default MainTabBar;
