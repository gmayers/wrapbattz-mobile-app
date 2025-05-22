import 'expo-dev-client';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/index';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import NfcManager from 'react-native-nfc-manager';
import * as SecureStore from 'expo-secure-store';

// IMPORTANT: Replace this with your actual API key
// This is the key that should match what's expected on your backend
const MOBILE_API_KEY = 'csG6Ho01W_zFPrAVtP_fhPzyTI-n1GmX8DIJQ6tGzy4'; // Update this with your real key!

export default function App() {
  useEffect(() => {
    // Set up the API key in SecureStore - using a fixed key name that matches AuthContext
    const setupApiKey = async () => {
      try {
        const API_KEY_STORAGE_KEY = 'apiKey';
        
        // Force update the API key every time to ensure it's correct
        await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, MOBILE_API_KEY);
        console.log('API key stored successfully:', MOBILE_API_KEY);
      } catch (error) {
        console.error('Error storing API key:', error);
      }
    };

    const requestPermissions = async () => {
      try {
        // Request media library permissions
        const mediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();
        console.log('Media library permission status:', mediaLibraryPermission.status);
        
        // Request image picker permissions (camera and photo library)
        const imagePickerCameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        console.log('Image picker camera permission status:', imagePickerCameraPermission.status);
        
        const imagePickerMediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('Image picker media permission status:', imagePickerMediaPermission.status);
        
        // Check and setup NFC (no explicit permission request API for NFC in Expo,
        // but we can check if it's available and initialize it)
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          const isNfcSupported = await NfcManager.isSupported();
          if (isNfcSupported) {
            await NfcManager.start();
            console.log('NFC started successfully');
          } else {
            console.log('NFC is not supported on this device');
          }
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
      }
    };

    // Run both setup functions
    setupApiKey().then(() => {
      // Verify the key was stored correctly
      SecureStore.getItemAsync('apiKey').then(key => {
        console.log('Verification - Stored API key:', key);
      });
    });
    
    requestPermissions();
    
    // Cleanup function
    return () => {
      // Clean up NFC when app is unmounted
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        NfcManager.isSupported()
          .then((supported) => {
            if (supported) {
              NfcManager.cancelTechnologyRequest().catch(() => {});
              NfcManager.unregisterTagEvent().catch(() => {});
            }
          })
          .catch(() => {});
      }
    };
  }, []);

  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}