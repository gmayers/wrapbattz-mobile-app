// components/TabBar.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

const TabBar = () => {
  const navigation = useNavigation();
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Yes, Logout',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.navigate('Dashboard')}
      >
        <Text>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.navigate('Reports')}
      >
        <Text>Reports</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={handleLogout}
      >
        <Text>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  tabItem: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
});

export default TabBar;