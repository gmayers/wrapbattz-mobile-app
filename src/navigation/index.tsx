import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { LinkingOptions } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ActivityIndicator, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import existing screens
import LoginScreen from '../screens/AuthScreens/LoginScreen';
import RegisterScreen from '../screens/AuthScreens/RegisterScreen';
import VerifyEmailScreen from '../screens/AuthScreens/VerifyEmail/VerifyEmailScreen';
import ForgotPasswordPage from '../screens/AuthScreens/ForgotPasswordPage';
import TabNavigation from './TabNavigation';
import AllReportsScreen from '../screens/AllReportsScreen';
import ReportDetailsScreen from '../screens/ReportDetailsScreen';
import AllDevicesScreen from '../screens/AllDevicesScreen';
import DeviceDetailsScreen from '../screens/DeviceDetailsScreen';
import AddDeviceScreen from '../screens/AddDeviceScreen';
import CreateReportScreen from '../screens/CreateReportScreen';
import LocationDetailsScreen from '../screens/LocationDetailsScreen';
import PricingScreen from '../screens/PricingScreen';
import SuggestFeatureScreen from '../screens/SuggestFeatureScreen';
import CreateOrganizationScreen from '../screens/CreateOrganizationScreen';
// Import new screens
import DataHandlingFeeScreen from '../screens/PaymentScreens/DataHandlingFeeScreen';
import ManageBillingScreen from '../screens/PaymentScreens/ManageBillingScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import QuickActionModalScreen from '../screens/QuickAction/QuickActionModalScreen';

const Stack = createStackNavigator();

const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [
    'https://api.tooltraq.com',
    'https://webportal.battwrapz.com',
    'tooltraq://',
    'wrapbattz://',
  ],
  config: {
    screens: {
      QuickActionModal: 'd/:tagUID',
    },
  },
};

const AuthStack = () => {
  const { colors } = useTheme();

  const themedHeaderStyle = {
    backgroundColor: colors.background,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          headerShown: true,
          headerTitle: 'Create Account',
          headerStyle: themedHeaderStyle,
          headerTitleStyle: { fontWeight: 'bold', color: colors.textPrimary },
          headerTintColor: colors.primary,
        }}
      />
      <Stack.Screen
        name="Pricing"
        component={PricingScreen}
        options={{
          headerShown: true,
          headerTitle: 'Pricing',
          headerStyle: themedHeaderStyle,
          headerTitleStyle: { fontWeight: 'bold', color: colors.textPrimary },
          headerTintColor: colors.primary,
        }}
      />
       <Stack.Screen
        name="SuggestFeature"
        component={SuggestFeatureScreen}
        options={{
          headerShown: true,
          headerTitle: 'Suggest a Feature',
          headerStyle: themedHeaderStyle,
          headerTitleStyle: { fontWeight: 'bold', color: colors.textPrimary },
          headerTintColor: colors.primary,
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordPage}
        options={{
          headerShown: true,
          headerTitle: 'Reset Password',
          headerStyle: themedHeaderStyle,
          headerTitleStyle: { fontWeight: 'bold', color: colors.textPrimary },
          headerTintColor: colors.primary,
        }}
      />
      <Stack.Screen
        name="VerifyEmail"
        component={VerifyEmailScreen}
        options={{
          headerShown: true,
          headerTitle: 'Verify Email',
          headerStyle: themedHeaderStyle,
          headerTitleStyle: { fontWeight: 'bold', color: colors.textPrimary },
          headerTintColor: colors.primary,
        }}
      />
    </Stack.Navigator>
  );
};

const MainStack = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const getHeaderStyle = () => ({
    backgroundColor: colors.background,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    height: Platform.OS === 'ios' ? 44 + insets.top : 56,
  });

  const headerTitleStyle = {
    fontWeight: 'bold',
    color: colors.textPrimary,
  };

  return (
    <Stack.Navigator>
      {/* Main Tab Navigation */}
      <Stack.Screen
        name="MainTabs"
        component={TabNavigation}
        options={{
          headerShown: false
        }}
      />

      {/* Modal/Detail Screens that should be above tabs */}
      <Stack.Screen
        name="CreateReport"
        component={CreateReportScreen}
        options={{
          headerTitle: 'Create Report',
          headerStyle: getHeaderStyle(),
          headerTitleStyle,
          headerTintColor: colors.primary,
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
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
    <Stack.Screen
      name="LocationDetails"
      component={LocationDetailsScreen}
      options={{
        headerShown: true,
        headerTitle: 'Location Details',
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
    <Stack.Screen
      name="DataHandlingFee"
      component={DataHandlingFeeScreen}
      options={{
        headerShown: true,
        headerTitle: 'Device Management Fee',
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
    <Stack.Screen
      name="ManageBilling"
      component={ManageBillingScreen}
      options={{
        headerShown: true,
        headerTitle: 'Manage Billing',
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
    <Stack.Screen
      name="EditProfile"
      component={EditProfileScreen}
      options={{
        headerShown: true,
        headerTitle: 'Edit Profile',
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
    <Stack.Screen
      name="ChangePassword"
      component={ChangePasswordScreen}
      options={{
        headerShown: true,
        headerTitle: 'Change Password',
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
    <Stack.Screen
      name="QuickActionModal"
      component={QuickActionModalScreen}
      options={{
        headerShown: false,
        presentation: 'modal',
        gestureEnabled: true,
      }}
    />
    {/* Add CreateOrganization screen to MainStack for users who need to access it */}
    <Stack.Screen
      name="CreateOrganization"
      component={CreateOrganizationScreen}
      options={{
        headerShown: true,
        headerTitle: 'Create Organization',
        headerStyle: getHeaderStyle(),
        headerTitleStyle,
        headerTintColor: colors.primary,
      }}
    />
  </Stack.Navigator>
  );
};

const LoadingScreen = () => {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

// FIXED: Simplified OnboardingStack that uses the correct field
const OnboardingStack = () => {
  const { onboardingComplete, userData } = useAuth();
  const { colors } = useTheme();

  // User needs onboarding only if they don't have an org AND haven't completed onboarding
  // This fixes the issue where admins (who have an orgId) were incorrectly routed to Create Organization
  const needsOnboarding = !userData?.orgId && !onboardingComplete && !(userData?.has_completed_onboarding);

  if (needsOnboarding) {
    return (
      <Stack.Navigator>
        <Stack.Screen
          name="CreateOrganization"
          component={CreateOrganizationScreen}
          options={{
            headerTitle: 'Create Organization',
            headerStyle: {
              backgroundColor: colors.background,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderLight,
            },
            headerTitleStyle: {
              fontWeight: 'bold',
              color: colors.textPrimary,
            },
            headerTintColor: colors.primary,
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
    <NavigationContainer linking={linking}>
      {isAuthenticated ? <OnboardingStack /> : <AuthStack />}
    </NavigationContainer>
  );
};
