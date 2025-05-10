import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

// Import screens
import LoginScreen from '../screens/AuthScreens/LoginScreen';
import RegisterScreen from '../screens/AuthScreens/RegisterScreen'; // Added RegisterScreen
import ForgotPasswordPage from '../screens/AuthScreens/ForgotPasswordPage';
import HomeScreen from '../screens/HomeScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AllReportsScreen from '../screens/AllReportsScreen';
import AllDevicesScreen from '../screens/AllDevicesScreen';
import AddDeviceScreen from '../screens/AddDeviceScreen';
import CreateReportScreen from '../screens/CreateReportScreen';
// Import new location screens
import LocationsScreen from '../screens/LocationsScreen';
import LocationDetailsScreen from '../screens/LocationDetailsScreen';

const Stack = createStackNavigator();

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen 
      name="Register" 
      component={RegisterScreen} 
      options={{
        headerShown: true,
        headerTitle: 'Create Account',
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f4',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    />
    <Stack.Screen 
      name="ForgotPassword" 
      component={ForgotPasswordPage}
      options={{
        headerShown: true,
        headerTitle: 'Reset Password',
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f4',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    />
  </Stack.Navigator>
);

const MainStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Dashboard"
      component={HomeScreen}
      options={{ 
        headerShown: false
      }}
    />
    <Stack.Screen
      name="Reports"
      component={ReportsScreen}
      options={{ 
        headerTitle: 'Reports',
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f4',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    />
    <Stack.Screen
      name="CreateReport"
      component={CreateReportScreen}
      options={{
        headerTitle: 'Create Report',
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f4',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    />
    <Stack.Screen
      name="AllReports"
      component={AllReportsScreen}
      options={{
        headerShown: false
      }}
    />
    <Stack.Screen
      name="AllDevices"
      component={AllDevicesScreen}
      options={{
        headerShown: false
      }}
    />
    <Stack.Screen
      name="AddDevice"
      component={AddDeviceScreen}
      options={{
        headerShown: true,
        headerTitle: 'Add New Device',
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f4',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    />
    {/* Add new location screens */}
    <Stack.Screen
      name="Locations"
      component={LocationsScreen}
      options={{
        headerShown: false
      }}
    />
    <Stack.Screen
      name="LocationDetails"
      component={LocationDetailsScreen}
      options={{
        headerShown: true,
        headerTitle: 'Location Details',
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f4',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    />
  </Stack.Navigator>
);

const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#007AFF" />
  </View>
);

export const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};