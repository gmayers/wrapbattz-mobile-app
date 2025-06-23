// src/screens/HomeScreen/components/Header.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../components/Button';

const { width } = Dimensions.get('window');
const ORANGE_COLOR = '#FF9500';

interface HeaderProps {
  userName: string;
  isAdminOrOwner: boolean;
  onProfilePress: () => void;
  onManageNFCPress: () => void;
  onAssignDevicePress: () => void;
}

const Header: React.FC<HeaderProps> = ({
  userName,
  isAdminOrOwner,
  onProfilePress,
  onManageNFCPress,
  onAssignDevicePress,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>
            Welcome {userName}
          </Text>
        </View>
        
        {/* Profile Button in Header */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={onProfilePress}
          testID="profile-button"
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Admin/Owner Buttons */}
      <View style={styles.buttonsContainer}>
        {isAdminOrOwner ? (
          <View style={styles.adminButtonContainer}>
            <Button
              title="Manage NFC"
              onPress={onManageNFCPress}
              size="small"
              textColor="black"
              style={[styles.headerButton, { backgroundColor: ORANGE_COLOR }]}
              testID="manage-nfc-button"
            />
            <Button
              title="Assign Device"
              onPress={onAssignDevicePress}
              size="small"
              textColor="black"
              style={[styles.headerButton, { backgroundColor: ORANGE_COLOR }]}
              testID="assign-device-button"
            />
          </View>
        ) : (
          <View style={styles.userButtonContainer}>
            <Button
              title="Request Device"
              onPress={onAssignDevicePress}
              size="small"
              textColor="black"
              style={[styles.fullWidthButton, { backgroundColor: ORANGE_COLOR }]}
              testID="request-device-button"
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: '5%',
    paddingVertical: '3%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: '3%',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 30,
  },
  profileButton: {
    marginLeft: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORANGE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonsContainer: {
    marginTop: 10,
    marginBottom: 5,
  },
  adminButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  userButtonContainer: {
    width: '100%',
    paddingVertical: 5,
    alignItems: 'center',
  },
  headerButton: {
    marginBottom: 8,
    marginHorizontal: 10,
    paddingHorizontal: 15,
    height: 45,
    minWidth: width > 375 ? (width / 2) - 60 : 'auto',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  fullWidthButton: {
    paddingHorizontal: 15,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    maxWidth: '80%',
    alignSelf: 'center',
  },
});

export default Header;