import * as auth from '../api/endpoints/auth';
import DeviceAuthService from '../services/DeviceAuthService';
import PinAuthService from '../services/PinAuthService';
import type { TokenResponse } from '../api/types';

export async function loginWithStoredCredentials(): Promise<TokenResponse> {
  const storedRefresh = await DeviceAuthService.getStoredRefreshToken();
  if (!storedRefresh) {
    throw new Error('No stored credentials on this device. Sign in with your password.');
  }
  const response = await auth.refresh(storedRefresh);
  await DeviceAuthService.saveCredentials(response.user.email, response.refresh_token);
  return response;
}

export async function enableBiometricUnlock(currentRefreshToken: string, email: string): Promise<void> {
  await DeviceAuthService.saveCredentials(email, currentRefreshToken);
  await DeviceAuthService.setBiometricEnabled(true);
}

export async function disableBiometricUnlock(): Promise<void> {
  await DeviceAuthService.setBiometricEnabled(false);
  const pinEnabled = await DeviceAuthService.isPinEnabled();
  if (!pinEnabled) {
    await DeviceAuthService.clearCredentials();
  }
}

export async function enablePinUnlock(
  pin: string,
  currentRefreshToken: string,
  email: string
): Promise<void> {
  await PinAuthService.setPin(pin);
  await DeviceAuthService.saveCredentials(email, currentRefreshToken);
  await DeviceAuthService.setPinEnabled(true);
}

export async function disablePinUnlock(): Promise<void> {
  await PinAuthService.clearPin();
  await DeviceAuthService.setPinEnabled(false);
  const bioEnabled = await DeviceAuthService.isBiometricEnabled();
  if (!bioEnabled) {
    await DeviceAuthService.clearCredentials();
  }
}
