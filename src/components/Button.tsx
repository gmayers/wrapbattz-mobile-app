// src/components/Button.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  DimensionValue,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ButtonProps {
  // Content props
  title: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;

  // Style props
  variant?: 'filled' | 'outlined' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  width?: DimensionValue;
  backgroundColorProp?: string;
  textColorProp?: string;
  borderRadius?: number;

  // State props
  loading?: boolean;
  disabled?: boolean;

  // Event handlers
  onPress: () => void;

  // Custom styles
  style?: ViewStyle;
  titleStyle?: TextStyle;
  loadingColor?: string;

  // Custom props
  loadingText?: string;
  activeOpacity?: number;
  testID?: string;
}

const Button: React.FC<ButtonProps> = ({
  // Content props
  title,
  leftIcon,
  rightIcon,

  // Style props
  variant = 'filled',
  size = 'medium',
  width: buttonWidth,
  backgroundColorProp,
  textColorProp,
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
  testID,
}) => {
  const { colors } = useTheme();

  // Determine background color based on variant and prop
  const getBackgroundColor = (): string => {
    if (disabled) return colors.disabled;
    if (backgroundColorProp) return backgroundColorProp;
    return variant === 'filled' ? colors.primary : 'transparent';
  };

  // Get variant styles
  const getVariantStyles = (): ViewStyle => {
    const backgroundColor = getBackgroundColor();
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: disabled ? colors.disabled : colors.primary,
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
  const getSizeStyles = (): ViewStyle => {
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
  const getTextColor = (): string => {
    if (textColorProp) return textColorProp;
    if (disabled) return colors.textSecondary;
    switch (variant) {
      case 'outlined':
      case 'ghost':
        return colors.primary;
      default: // 'filled'
        return (colors as any).onPrimary ?? colors.textPrimary;
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
      testID={testID}
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