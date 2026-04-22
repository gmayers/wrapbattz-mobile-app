import 'expo-dev-client';
import React, { useEffect, useCallback } from 'react';

console.log('🎯 App.js - File loaded successfully!');
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { SessionExpiryAlert } from './src/auth/SessionExpiryAlert';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/index';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import NfcManager from 'react-native-nfc-manager';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { STRIPE_CONFIG, validateStripeConfig } from './src/config/stripe';
// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://277ff03f5d87270ffeba62cd99fbd265@o4508371086999552.ingest.de.sentry.io/4510799870623824',
  tracesSampleRate: 1.0,
});

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

function App() {
  console.log('🚀 App.js - Starting App component render');
  console.log('🔧 App.js - Platform:', Platform.OS);
  console.log('📱 App.js - __DEV__ mode:', __DEV__);

  const [fontsLoaded] = useFonts({
    Brookline: require('./Brookline-amibwk-_1_.otf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Validate Stripe configuration
  if (!validateStripeConfig()) {
    console.error('❌ Stripe configuration invalid - payments may not work');
  }

  useEffect(() => {
    const requestPermissions = async () => {
      try {
        await MediaLibrary.requestPermissionsAsync();
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          const isNfcSupported = await NfcManager.isSupported();
          if (isNfcSupported) {
            await NfcManager.start();
          }
        }
      } catch (error) {
        console.error('App.js - Error requesting permissions:', error);
      }
    };

    requestPermissions().catch(error => {
      console.error('❌ App.js - Error in requestPermissions:', error);
    });

    const checkForUpdates = async () => {
      try {
        if (__DEV__) return;
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.log('Error checking for updates:', error);
      }
    };

    checkForUpdates();

    // Cleanup function
    return () => {
      console.log('🧹 App.js - Cleaning up...');
      // Clean up NFC when app is unmounted
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        NfcManager.isSupported()
          .then((supported) => {
            if (supported) {
              console.log('🧹 App.js - Cleaning up NFC...');
              NfcManager.cancelTechnologyRequest().catch(() => {});
              NfcManager.unregisterTagEvent().catch(() => {});
            }
          })
          .catch(() => {});
      }
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  console.log('🏗️ App.js - Rendering component tree...');

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <StripeProvider
        publishableKey={STRIPE_CONFIG.publishableKey}
        merchantIdentifier={STRIPE_CONFIG.merchantIdentifier}
        urlScheme={STRIPE_CONFIG.urlScheme}
      >
        <AuthProvider>
          <SessionExpiryAlert />
          <ThemeProvider>
            <AppNavigator />
          </ThemeProvider>
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
