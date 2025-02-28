import 'expo-dev-client';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/index';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import NfcManager from 'react-native-nfc-manager';

export default function App() {
  useEffect(() => {
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