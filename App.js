import 'expo-dev-client';
import React, { useEffect, useCallback } from 'react';

console.log('🎯 App.js - File loaded successfully!');
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/index';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import NfcManager from 'react-native-nfc-manager';
import * as SecureStore from 'expo-secure-store';
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

// IMPORTANT: Replace this with your actual API key
// This is the key that should match what's expected on your backend
const MOBILE_API_KEY = 'csG6Ho01W_zFPrAVtP_fhPzyTI-n1GmX8DIJQ6tGzy4'; // Update this with your real key!

console.log('📦 App.js - All imports loaded successfully');
console.log('🔍 App.js - AuthProvider:', typeof AuthProvider);
console.log('🔍 App.js - AppNavigator:', typeof AppNavigator);

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
    console.log('⚡ App.js - useEffect starting...');
    // Set up the API key in SecureStore - using a fixed key name that matches AuthContext
    const setupApiKey = async () => {
      try {
        console.log('🔑 App.js - Setting up API key...');
        const API_KEY_STORAGE_KEY = 'apiKey';

        // Force update the API key every time to ensure it's correct
        await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, MOBILE_API_KEY);
        console.log('✅ App.js - API key stored successfully:', MOBILE_API_KEY);
      } catch (error) {
        console.error('❌ App.js - Error storing API key:', error);
      }
    };

    const requestPermissions = async () => {
      try {
        console.log('🔒 App.js - Requesting permissions...');

        // Request media library permissions
        console.log('📚 App.js - Requesting media library permissions...');
        const mediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();
        console.log('✅ App.js - Media library permission status:', mediaLibraryPermission.status);

        // Request image picker permissions (camera and photo library)
        console.log('📷 App.js - Requesting camera permissions...');
        const imagePickerCameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        console.log('✅ App.js - Image picker camera permission status:', imagePickerCameraPermission.status);

        console.log('🖼️ App.js - Requesting media library permissions...');
        const imagePickerMediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('✅ App.js - Image picker media permission status:', imagePickerMediaPermission.status);

        // Check and setup NFC (no explicit permission request API for NFC in Expo,
        // but we can check if it's available and initialize it)
        console.log('📡 App.js - Setting up NFC...');
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          const isNfcSupported = await NfcManager.isSupported();
          if (isNfcSupported) {
            await NfcManager.start();
            console.log('✅ App.js - NFC started successfully');
          } else {
            console.log('⚠️ App.js - NFC is not supported on this device');
          }
        }

        console.log('✅ App.js - All permissions setup completed');
      } catch (error) {
        console.error('❌ App.js - Error requesting permissions:', error);
      }
    };

    // Run both setup functions
    console.log('🚀 App.js - Starting setup functions...');
    setupApiKey().then(() => {
      console.log('🔍 App.js - Verifying API key storage...');
      // Verify the key was stored correctly
      SecureStore.getItemAsync('apiKey').then(key => {
        console.log('✅ App.js - Verification - Stored API key:', key);
      }).catch(error => {
        console.error('❌ App.js - Error verifying API key:', error);
      });
    }).catch(error => {
      console.error('❌ App.js - Error in setupApiKey:', error);
    });

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
        {console.log('💳 App.js - StripeProvider rendered')}
        <AuthProvider>
          {console.log('🔐 App.js - AuthProvider rendered')}
          <ThemeProvider>
            <AppNavigator />
          </ThemeProvider>
          {console.log('🧭 App.js - AppNavigator rendered')}
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
