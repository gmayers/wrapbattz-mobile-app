import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEYS = {
  REFRESH_TOKEN: 'wb.deviceAuth.refreshToken',
  ACCOUNT_EMAIL: 'wb.deviceAuth.accountEmail',
  BIOMETRIC_ENABLED: 'wb.deviceAuth.biometricEnabled',
  PIN_ENABLED: 'wb.deviceAuth.pinEnabled',
  STAY_SIGNED_IN: 'wb.deviceAuth.staySignedIn',
} as const;

export type BiometricType = 'faceId' | 'touchId' | 'fingerprint' | 'iris' | 'generic' | 'none';

export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  type: BiometricType;
  label: string;
}

const biometricLabel = (type: BiometricType): string => {
  if (Platform.OS === 'ios') {
    if (type === 'faceId') return 'Face ID';
    if (type === 'touchId') return 'Touch ID';
    return 'Biometric';
  }
  if (type === 'fingerprint') return 'Fingerprint';
  if (type === 'iris') return 'Iris';
  return 'Biometric';
};

export const DeviceAuthService = {
  async getBiometricCapability(): Promise<BiometricCapability> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, enrolled: false, type: 'none', label: 'Biometric' };
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let type: BiometricType = 'generic';
    if (Platform.OS === 'ios') {
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) type = 'faceId';
      else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) type = 'touchId';
    } else {
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) type = 'fingerprint';
      else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) type = 'iris';
      else if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) type = 'generic';
    }

    return { available: true, enrolled, type, label: biometricLabel(type) };
  },

  async authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
    const cap = await this.getBiometricCapability();
    if (!cap.available || !cap.enrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
    return result.success;
  },

  async saveCredentials(email: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(KEYS.ACCOUNT_EMAIL, email, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getStoredRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async getStoredEmail(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCOUNT_EMAIL);
  },

  async clearCredentials(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.ACCOUNT_EMAIL);
  },

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.BIOMETRIC_ENABLED, enabled ? '1' : '0');
  },

  async isBiometricEnabled(): Promise<boolean> {
    return (await AsyncStorage.getItem(KEYS.BIOMETRIC_ENABLED)) === '1';
  },

  async setPinEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.PIN_ENABLED, enabled ? '1' : '0');
  },

  async isPinEnabled(): Promise<boolean> {
    return (await AsyncStorage.getItem(KEYS.PIN_ENABLED)) === '1';
  },

  async setStaySignedIn(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.STAY_SIGNED_IN, enabled ? '1' : '0');
  },

  async getStaySignedIn(): Promise<boolean> {
    const v = await AsyncStorage.getItem(KEYS.STAY_SIGNED_IN);
    return v === null ? true : v === '1';
  },

  async disableAllQuickAuth(): Promise<void> {
    await this.setBiometricEnabled(false);
    await this.setPinEnabled(false);
    await this.clearCredentials();
  },
};

export default DeviceAuthService;
