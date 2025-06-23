// src/navigation/TabNavigation.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// Import screens
import HomeScreen from '../screens/HomeScreen/HomeScreen';
import ReportsScreen from '../screens/ReportsScreen';
import LocationsScreen from '../screens/LocationsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const ORANGE_COLOR = '#FF9500';

const TabNavigation = () => {
  const { logout, userData } = useAuth();
  
  // User role and permissions
  const userRole = userData?.role;
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Custom component for logout "screen" that triggers logout
  const LogoutScreen = () => {
    React.useEffect(() => {
      handleLogout();
    }, []);
    return null;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Reports':
              iconName = focused ? 'document-text' : 'document-text-outline';
              break;
            case 'Locations':
              iconName = focused ? 'location' : 'location-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'Logout':
              iconName = focused ? 'log-out' : 'log-out-outline';
              break;
            default:
              iconName = 'circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: ORANGE_COLOR,
        tabBarInactiveTintColor: '#666666',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          paddingBottom: Platform.OS === 'ios' ? 20 : 0,
          height: Platform.OS === 'ios' ? 80 : 60,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 4,
          fontWeight: '500',
        },
        tabBarIconStyle: {
          fontSize: 24,
        },
      })}
    >
      {/* Home Tab */}
      <Tab.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />

      {/* Reports Tab */}
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarLabel: 'Reports',
        }}
      />

      {/* Locations Tab - Only for Admin/Owner */}
      {isAdminOrOwner ? (
        <Tab.Screen
          name="Locations"
          component={LocationsScreen}
          options={{
            tabBarLabel: 'Locations',
          }}
        />
      ) : null}

      {/* Profile Tab */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />

      {/* Logout Tab */}
      <Tab.Screen
        name="Logout"
        component={LogoutScreen}
        options={{
          tabBarLabel: 'Logout',
        }}
        listeners={() => ({
          tabPress: (e) => {
            // Prevent default tab press behavior
            e.preventDefault();
            // Trigger logout directly
            handleLogout();
          },
        })}
      />
    </Tab.Navigator>
  );
};

export default TabNavigation;