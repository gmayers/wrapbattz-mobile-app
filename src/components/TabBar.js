// components/TabBar/TabBar.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';

const { width } = Dimensions.get('window');

const TabBar = ({
  // Required props
  tabs = [], // Provide empty array as default
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

  // Guard against empty tabs
  if (!tabs || tabs.length === 0) {
    console.warn('TabBar: No tabs provided');
    return null;
  }

  // Handle tab press with animation
  const handleTabPress = (tab, index) => {
    if (animated) {
      Animated.timing(indicatorAnim, {
        toValue: index,
        duration: animationDuration,
        useNativeDriver: true,
      }).start();
    }
    if (onTabPress) {
      onTabPress(tab.key);
    }
  };

  // Calculate indicator position
  const translateX = indicatorAnim.interpolate({
    inputRange: [0, Math.max(tabs.length - 1, 1)],
    outputRange: [0, width - (width / Math.max(tabs.length, 1))],
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
            {showIcons && tab.icon && (
              typeof tab.icon === 'string' ? (
                <Text style={[styles.icon, { color }, iconStyle]}>
                  {tab.icon}
                </Text>
              ) : (
                React.cloneElement(tab.icon, { 
                  color,
                  style: [styles.icon, iconStyle, tab.icon.props.style],
                  size: iconStyle?.fontSize || 24
                })
              )
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

export default TabBar;