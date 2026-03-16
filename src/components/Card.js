import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const Card = ({
  // Content props
  title,
  subtitle,
  children,
  imageSource,
  onPress,

  // Style props
  width: cardWidth = width * 0.9,
  height,
  backgroundColor: backgroundColorProp,
  borderRadius = 10,
  elevation = 5,
  padding = 15,

  // Custom styles
  containerStyle,
  titleStyle,
  subtitleStyle,
  contentStyle,
  imageStyle,

  // Shadow props
  shadowColor: shadowColorProp,
  shadowOpacity = 0.25,
  shadowOffset = { width: 0, height: 2 },
  shadowRadius = 3.84,

  // Image props
  imageHeight = 200,
  imageFit = 'cover',

  // Header props
  headerContent,
  headerStyle,

  // Footer props
  footerContent,
  footerStyle,

  // Border props
  borderColor,
  borderWidth,

  // Disabled state
  disabled = false,
  disabledStyle,
  disabledOpacity = 0.6,
}) => {
  const { colors } = useTheme();
  const backgroundColor = backgroundColorProp || colors.card;
  const shadowColor = shadowColorProp || colors.shadow;
  const CardContainer = onPress ? TouchableOpacity : View;

  const containerStyles = [
    styles.container,
    {
      width: cardWidth,
      height,
      backgroundColor,
      borderRadius,
      padding,
      borderColor,
      borderWidth,
    },
    containerStyle,
    disabled && [styles.disabled, { opacity: disabledOpacity, backgroundColor: colors.surfaceAlt }, disabledStyle],
  ];

  if (elevation) {
    containerStyles.push({
      elevation,
      shadowColor,
      shadowOffset,
      shadowOpacity,
      shadowRadius,
    });
  }

  return (
    <CardContainer 
      style={containerStyles}
      onPress={disabled ? null : onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      {headerContent && (
        <View style={[styles.header, headerStyle]}>
          {headerContent}
        </View>
      )}

      {/* Image */}
      {imageSource && (
        <Image
          source={imageSource}
          style={[
            styles.image,
            {
              height: imageHeight,
              resizeMode: imageFit,
              borderTopLeftRadius: borderRadius,
              borderTopRightRadius: borderRadius,
            },
            imageStyle,
          ]}
        />
      )}

      {/* Title Section */}
      {(title || subtitle) && (
        <View style={styles.titleContainer}>
          {title && (
            <Text style={[styles.title, { color: colors.textPrimary }, titleStyle]}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }, subtitleStyle]}>
              {subtitle}
            </Text>
          )}
        </View>
      )}

      {/* Content */}
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>

      {/* Footer */}
      {footerContent && (
        <View style={[styles.footer, { borderTopColor: colors.border }, footerStyle]}>
          {footerContent}
        </View>
      )}
    </CardContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    overflow: 'hidden',
  },
  disabled: {},
  header: {
    marginBottom: 10,
  },
  image: {
    width: '100%',
    marginTop: -15, // Compensate for container padding
    marginBottom: 10,
  },
  titleContainer: {
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  footer: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
});

// Usage Examples
const ExampleUsage = () => {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 15 }}>
      {/* Basic Card */}
      <Card
        title="Basic Card"
        subtitle="Simple card with title and subtitle"
      >
        <Text>Card content goes here</Text>
      </Card>

      {/* Image Card */}
      <Card
        imageSource={{ uri: 'https://example.com/image.jpg' }}
        title="Image Card"
        subtitle="Card with image"
        imageHeight={150}
      >
        <Text>Card with image content</Text>
      </Card>

      {/* Interactive Card */}
      <Card
        title="Interactive Card"
        onPress={() => console.log('Card pressed')}
        headerContent={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>Header</Text>
            <Text>⋮</Text>
          </View>
        }
        footerContent={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>Footer Left</Text>
            <Text>Footer Right</Text>
          </View>
        }
        containerStyle={{
          backgroundColor: '#f8f8f8',
        }}
        elevation={8}
      >
        <Text>Interactive card content</Text>
      </Card>

      {/* Custom Styled Card */}
      <Card
        title="Custom Card"
        backgroundColor="#f0f8ff"
        borderRadius={15}
        borderColor="#007AFF"
        borderWidth={1}
        elevation={10}
        shadowColor="#007AFF"
        shadowOpacity={0.3}
        titleStyle={{
          color: '#007AFF',
          fontSize: 20,
        }}
        containerStyle={{
          margin: 20,
        }}
      >
        <Text>Custom styled card content</Text>
      </Card>
    </View>
  );
};

export default Card;