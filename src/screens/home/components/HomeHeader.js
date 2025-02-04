// HomeHeader.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../../../components/Button';

/**
 * HomeHeader Component
 * @param {Object} props - Component props
 * @param {Function} props.onNFCPress - Handler for NFC button press
 * @param {Function} props.onAssignPress - Handler for Assign button press
 * @param {string} props.username - Username to display
 * @returns {JSX.Element} Header component
 */
const HomeHeader = ({ 
  onNFCPress, 
  onAssignPress,
  username = 'User' // Default value if no username provided
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container, 
      { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 10 }
    ]}>
      <View style={styles.content}>
        {/* Welcome Section */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText} accessibilityRole="header">
            Welcome{'\n'}
            <Text style={styles.usernameText}>{username}</Text>
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="NFC Manager"
            onPress={onNFCPress}
            size="small"
            style={styles.headerButton}
            accessibilityLabel="Open NFC Manager"
            accessibilityHint="Opens the NFC tag management interface"
          />
          <Button
            title="Assign Device"
            onPress={onAssignPress}
            size="small"
            style={styles.headerButton}
            accessibilityLabel="Assign Device"
            accessibilityHint="Opens the device assignment interface"
          />
        </View>
      </View>

      {/* Bottom Border */}
      <View style={styles.border} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    zIndex: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  welcomeContainer: {
    flex: 2,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 26,
    color: '#333',
    lineHeight: 32,
  },
  usernameText: {
    fontWeight: 'bold',
  },
  spacer: {
    width: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerButton: {
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  border: {
    height: 1,
    backgroundColor: '#E0E0E0',
    width: '100%',
  },
});

export default HomeHeader;