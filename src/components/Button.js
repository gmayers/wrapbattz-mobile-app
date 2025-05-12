import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

const Button = ({
  // Content props
  title,
  leftIcon,
  rightIcon,

  // Style props
  variant = 'filled', // 'filled', 'outlined', 'ghost'
  size = 'medium',    // 'small', 'medium', 'large'
  width: buttonWidth, // optional override for button width
  backgroundColorProp, // Renamed to avoid confusion with internal logic
  textColorProp,     // Renamed to avoid confusion with internal logic
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
  // Determine background color based on variant and prop
  const getBackgroundColor = () => {
    if (disabled) return '#ccc';
    if (backgroundColorProp) return backgroundColorProp;
    return variant === 'filled' ? '#FF8C00' : 'transparent';
  };

  // Get variant styles
  const getVariantStyles = () => {
    const backgroundColor = getBackgroundColor();
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: disabled ? '#ccc' : '#FF8C00',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      default: // 'filled'
        return {
          backgroundColor: backgroundColor,
        };
    }
  };

  // Get size styles
  const getSizeStyles = () => {
    // If a custom width was provided, we'll apply it.
    // Otherwise, we let the button shrink/grow based on its content.
    const widthStyle = buttonWidth ? { width: buttonWidth } : {};

    switch (size) {
      case 'small':
        return {
          paddingVertical: 8,
          paddingHorizontal: 12,
          ...widthStyle,
        };
      case 'large':
        return {
          paddingVertical: 16,
          paddingHorizontal: 24,
          ...widthStyle,
        };
      default: // 'medium'
        return {
          paddingVertical: 12,
          paddingHorizontal: 16,
          ...widthStyle,
        };
    }
  };

  // Get text color based on variant and prop
  const getTextColor = () => {
    if (textColorProp) return textColorProp;
    if (disabled) return '#666';
    switch (variant) {
      case 'outlined':
      case 'ghost':
        return '#FF8C00';
      default: // 'filled'
        return 'black';
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
          <Text style={[styles.title, { color: getTextColor() }, titleStyle]}>
            {loadingText}
          </Text>
        </>
      ) : (
        <>
          {leftIcon}
          <Text style={[styles.title, { color: getTextColor() }, titleStyle]}>
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