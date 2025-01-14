import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const Button = ({
  // Content props
  title,
  leftIcon,
  rightIcon,
  
  // Style props
  variant = 'filled', // 'filled', 'outlined', 'ghost'
  size = 'medium', // 'small', 'medium', 'large'
  width: buttonWidth,
  backgroundColor = '#007AFF',
  textColor,
  borderRadius = 8,
  
  // State props
  loading = false,
  disabled = false,
  
  // Event handlers
  onPress,
  
  // Custom styles
  style,
  titleStyle,
  loadingColor,
  
  // Custom props
  loadingText = 'Loading...',
  activeOpacity = 0.7,
}) => {
  // Get variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: disabled ? '#ccc' : backgroundColor,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      default: // filled
        return {
          backgroundColor: disabled ? '#ccc' : backgroundColor,
        };
    }
  };

  // Get size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 8,
          paddingHorizontal: 12,
          width: buttonWidth || width * 0.3,
        };
      case 'large':
        return {
          paddingVertical: 16,
          paddingHorizontal: 24,
          width: buttonWidth || width * 0.9,
        };
      default: // medium
        return {
          paddingVertical: 12,
          paddingHorizontal: 16,
          width: buttonWidth || width * 0.6,
        };
    }
  };

  // Get text color based on variant
  const getTextColor = () => {
    if (textColor) return textColor;
    if (disabled) return '#666';
    switch (variant) {
      case 'outlined':
      case 'ghost':
        return backgroundColor;
      default:
        return 'white';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        { borderRadius },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={activeOpacity}
    >
      {loading ? (
        <>
          <ActivityIndicator 
            color={loadingColor || getTextColor()} 
            style={styles.loadingIndicator} 
          />
          <Text style={[
            styles.title,
            { color: getTextColor() },
            titleStyle,
          ]}>
            {loadingText}
          </Text>
        </>
      ) : (
        <>
          {leftIcon}
          <Text style={[
            styles.title,
            { color: getTextColor() },
            titleStyle,
          ]}>
            {title}
          </Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  loadingIndicator: {
    marginRight: 8,
  },
});

export default Button;