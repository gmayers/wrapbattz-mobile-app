import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';

const { width } = Dimensions.get('window');

const TabBar = ({
  // Tab configuration
  tabs = [
    { key: 'read', title: 'Read', icon: '📖' },
    { key: 'write', title: 'Write', icon: '✏️' },
    { key: 'lock', title: 'Lock', icon: '🔒' },
    { key: 'protect', title: 'Protect', icon: '🛡️' },
    { key: 'remove', title: 'Remove', icon: '🗑️' }
  ],
  activeTab,
  onTabPress,
  
  // Customization props
  backgroundColor = '#FFFFFF',
  activeColor = '#007AFF',
  inactiveColor = '#666666',
  showIcons = true,
  showLabels = true,
  position = 'bottom',
  height = 60,
  containerStyle,
  tabStyle,
  labelStyle,
  iconStyle,
  indicatorStyle,
  showIndicator = true,
  
  // Animation props
  animated = true,
  animationDuration = 200
}) => {
  // Animation value for the indicator
  const [indicatorAnim] = React.useState(new Animated.Value(0));
  const [tabWidths, setTabWidths] = React.useState({});

  // Handle tab press with animation
  const handleTabPress = (tab, index) => {
    if (animated) {
      Animated.timing(indicatorAnim, {
        toValue: index,
        duration: animationDuration,
        useNativeDriver: true,
      }).start();
    }
    onTabPress(tab.key);
  };

  // Calculate indicator position
  const translateX = indicatorAnim.interpolate({
    inputRange: [0, tabs.length - 1],
    outputRange: [0, width - (width / tabs.length)],
  });

  // Get position styles
  const getPositionStyle = () => ({
    [position]: 0,
  });

  return (
    <View 
      style={[
        styles.container, 
        { backgroundColor, height }, 
        getPositionStyle(),
        containerStyle
      ]}
    >
      {showIndicator && (
        <Animated.View 
          style={[
            styles.indicator,
            {
              backgroundColor: activeColor,
              width: `${100 / tabs.length}%`,
              transform: [{ translateX }],
            },
            indicatorStyle
          ]}
        />
      )}
      
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.key;
        const color = isActive ? activeColor : inactiveColor;

        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              tabStyle,
              isActive && styles.activeTab
            ]}
            onPress={() => handleTabPress(tab, index)}
            onLayout={(e) => {
              const { width } = e.nativeEvent.layout;
              setTabWidths(prev => ({ ...prev, [tab.key]: width }));
            }}
          >
            {showIcons && (
              <Text style={[styles.icon, { color }, iconStyle]}>
                {tab.icon}
              </Text>
            )}
            {showLabels && (
              <Text style={[
                styles.label,
                { color },
                labelStyle,
                isActive && styles.activeLabel
              ]}>
                {tab.title}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    position: 'absolute',
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  activeLabel: {
    fontWeight: '600',
  },
  icon: {
    fontSize: 20,
  },
  indicator: {
    position: 'absolute',
    height: 3,
    top: 0,
    borderRadius: 1.5,
  },
});

// Usage Example
const ExampleUsage = () => {
  const [activeTab, setActiveTab] = React.useState('read');

  return (
    <View style={{ flex: 1 }}>
      {/* Basic Usage */}
      <TabBar
        activeTab={activeTab}
        onTabPress={setActiveTab}
      />

      {/* Customized Usage */}
      <TabBar
        activeTab={activeTab}
        onTabPress={setActiveTab}
        backgroundColor="#F8F8F8"
        activeColor="#4CAF50"
        inactiveColor="#999999"
        showIcons={true}
        showLabels={true}
        position="bottom"
        height={70}
        animated={true}
        containerStyle={{
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -5,
          },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 15,
        }}
        indicatorStyle={{
          backgroundColor: '#4CAF50',
          height: 4,
        }}
        labelStyle={{
          fontSize: 13,
          fontWeight: '500',
        }}
        iconStyle={{
          fontSize: 24,
        }}
      />
    </View>
  );
};

export default TabBar;