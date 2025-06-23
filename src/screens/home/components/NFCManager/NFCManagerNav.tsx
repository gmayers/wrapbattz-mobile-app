// src/screens/home/components/NFCManager/NFCManagerNav.tsx - Dedicated NFC Manager Navigation
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ORANGE_COLOR = '#FF9500';

export interface NFCTab {
  key: string;
  title: string;
  icon: string;
}

interface NFCManagerNavProps {
  tabs: NFCTab[];
  activeTab: string;
  onTabPress: (tabKey: string) => void;
}

const NFCManagerNav: React.FC<NFCManagerNavProps> = ({
  tabs,
  activeTab,
  onTabPress
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                isActive && styles.activeTabButton
              ]}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.7}
            >
              <View style={styles.tabContent}>
                <Ionicons
                  name={tab.icon as any}
                  size={20}
                  color={isActive ? ORANGE_COLOR : '#666666'}
                  style={styles.tabIcon}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.activeTabLabel
                  ]}
                >
                  {tab.title}
                </Text>
              </View>
              
              {/* Highlight bar */}
              {isActive && <View style={styles.highlightBar} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: Platform.OS === 'ios' ? 10 : 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingTop: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    position: 'relative',
    minHeight: 50,
  },
  activeTabButton: {
    // Active state styling handled by highlight bar and text color
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 14,
  },
  activeTabLabel: {
    color: ORANGE_COLOR,
    fontWeight: '600',
  },
  highlightBar: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: ORANGE_COLOR,
    borderRadius: 1.5,
  },
});

export default NFCManagerNav;