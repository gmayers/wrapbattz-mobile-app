import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

// Import existing screens
import LoginScreen from '../screens/AuthScreens/LoginScreen';
import RegisterScreen from '../screens/AuthScreens/RegisterScreen';
import ForgotPasswordPage from '../screens/AuthScreens/ForgotPasswordPage';
import HomeScreen from '../screens/HomeScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AllReportsScreen from '../screens/AllReportsScreen';
import ReportDetailsScreen from '../screens/ReportDetailsScreen';
import AllDevicesScreen from '../screens/AllDevicesScreen';
import DeviceDetailsScreen from '../screens/DeviceDetailsScreen';
import AddDeviceScreen from '../screens/AddDeviceScreen';
import CreateReportScreen from '../screens/CreateReportScreen';
import LocationsScreen from '../screens/LocationsScreen';
import LocationDetailsScreen from '../screens/LocationDetailsScreen';
import PricingScreen from '../screens/PricingScreen';
import SuggestFeatureScreen from '../screens/SuggestFeatureScreen';
import CreateOrganizationScreen from '../screens/CreateOrganizationScreen';
// Import new screens
import DataHandlingFeeScreen from '../screens/PaymentScreens/DataHandlingFeeScreen';
import ManageBillingScreen from '../screens/PaymentScreens/ManageBillingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';

const Stack = createStackNavigator();

// Orange color to match UI
const ORANGE_COLOR = '#FF9500';

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
      name="Pricing" 
      component={PricingScreen} 
      options={{
        headerShown: true,
        headerTitle: 'Pricing',
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
      name="SuggestFeature"
      component={SuggestFeatureScreen}
      options={{
        headerShown: true,
        headerTitle: 'Suggest a Feature',
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
      name="ReportDetails"
      component={ReportDetailsScreen}
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
      name="DeviceDetails"
      component={DeviceDetailsScreen}
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
    
    <Stack.Screen
      name="DataHandlingFee"
      component={DataHandlingFeeScreen}
      options={{
        headerShown: true,
        headerTitle: 'Device Management Fee',
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
        headerTintColor: ORANGE_COLOR,
      }}
    />
    <Stack.Screen
      name="ManageBilling"
      component={ManageBillingScreen}
      options={{
        headerShown: true,
        headerTitle: 'Manage Billing',
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
        headerTintColor: ORANGE_COLOR,
      }}
    />
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        headerShown: true,
        headerTitle: 'My Profile',
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
        headerTintColor: ORANGE_COLOR,
      }}
    />
    <Stack.Screen
      name="EditProfile"
      component={EditProfileScreen}
      options={{
        headerShown: true,
        headerTitle: 'Edit Profile',
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
        headerTintColor: ORANGE_COLOR,
      }}
    />
    <Stack.Screen
      name="ChangePassword"
      component={ChangePasswordScreen}
      options={{
        headerShown: true,
        headerTitle: 'Change Password',
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
        headerTintColor: ORANGE_COLOR,
      }}
    />
    {/* Add CreateOrganization screen to MainStack for users who need to access it */}
    <Stack.Screen
      name="CreateOrganization"
      component={CreateOrganizationScreen}
      options={{
        headerShown: true,
        headerTitle: 'Create Organization',
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
        headerTintColor: ORANGE_COLOR,
      }}
    />
  </Stack.Navigator>
);

const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color={ORANGE_COLOR} />
  </View>
);

// FIXED: Simplified OnboardingStack that uses the correct field
const OnboardingStack = () => {
  const { onboardingComplete, userData } = useAuth();

  // Use the correct onboarding field from your AuthContext
  const needsOnboarding = !onboardingComplete && !(userData?.has_completed_onboarding);

  if (needsOnboarding) {
    return (
      <Stack.Navigator>
        <Stack.Screen 
          name="CreateOrganization" 
          component={CreateOrganizationScreen}
          options={{ 
            headerTitle: 'Create Organization',
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
  }

  // If onboarding is complete, show main app
  return <MainStack />;
};

export const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <OnboardingStack /> : <AuthStack />}
    </NavigationContainer>
  );
};