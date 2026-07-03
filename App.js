import 'expo-dev-client';
import React, { useEffect, useCallback } from 'react';

console.log('🎯 App.js - File loaded successfully!');
import { Platform, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { SessionExpiryAlert } from './src/auth/SessionExpiryAlert';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/index';
import NfcManager from 'react-native-nfc-manager';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { STRIPE_CONFIG, validateStripeConfig } from './src/config/stripe';
import { iapService, flushPendingReceipts } from './src/iap';
// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://277ff03f5d87270ffeba62cd99fbd265@o4508371086999552.ingest.de.sentry.io/4510799870623824',
  tracesSampleRate: 1.0,
});

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

// Minimum time (ms) the splash stays up so the brand mark is readable rather
// than flashing by the instant fonts finish loading. Timed from module load
// (app launch). If fonts take longer than this, the longer wait wins.
const SPLASH_MIN_DISPLAY_MS = 1500;
const splashShownAt = Date.now();

function App() {
  console.log('🚀 App.js - Starting App component render');
  console.log('🔧 App.js - Platform:', Platform.OS);
  console.log('📱 App.js - __DEV__ mode:', __DEV__);

  const [fontsLoaded] = useFonts({
    Brookline: require('./Brookline-amibwk-_1_.otf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      const remaining = SPLASH_MIN_DISPLAY_MS - (Date.now() - splashShownAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Validate Stripe configuration
  if (!validateStripeConfig()) {
    console.error('❌ Stripe configuration invalid - payments may not work');
  }

  useEffect(() => {
    // Camera/photo access is requested in-context at the point of use (when the
    // user taps "Take Photo"); gallery selection uses the permission-free system
    // photo picker. Only NFC needs initialising up front.
    const initNfc = async () => {
      try {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          const isNfcSupported = await NfcManager.isSupported();
          if (isNfcSupported) {
            await NfcManager.start();
          }
        }
      } catch (error) {
        console.error('App.js - Error initialising NFC:', error);
      }
    };

    initNfc().catch(error => {
      console.error('❌ App.js - Error in initNfc:', error);
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

    // Initialize IAP (best effort — store may be unavailable in dev/sim) and
    // flush any receipts that didn't reach the backend last time the app
    // closed. AppState 'active' transitions trigger another flush attempt.
    iapService.init().catch((e) => console.warn('[iap] init failed:', e));
    flushPendingReceipts().catch((e) => console.warn('[iap] initial flush failed:', e));
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') flushPendingReceipts().catch(() => {});
    });

    // Cleanup function
    return () => {
      console.log('🧹 App.js - Cleaning up...');
      appStateSub.remove();
      iapService.teardown().catch(() => {});
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
