// Registers this device's Expo push token with the backend and removes it on
// logout. Registration is best-effort: permission denied, simulators and
// network failures all resolve quietly so sign-in is never blocked.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { registerForPush } from '../services/NotificationService';
import { registerPushToken, unregisterPushToken } from '../api/endpoints/account';

const KEY = 'notifications.pushRegistration.v1';

interface Stored {
  token: string;
  userId: number;
  orgId: number;
}

async function readStored(): Promise<Stored | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

async function deviceId(): Promise<string> {
  try {
    if (Platform.OS === 'android') return Application.getAndroidId() ?? '';
    if (Platform.OS === 'ios') return (await Application.getIosIdForVendorAsync()) ?? '';
  } catch {
    // fall through
  }
  return '';
}

export async function syncPushRegistration(ctx: {
  userId: number;
  orgId: number;
}): Promise<'registered' | 'unchanged' | 'skipped'> {
  const result = await registerForPush();
  if (result.status !== 'granted' || !result.token || result.platform === 'web') {
    return 'skipped';
  }
  const stored = await readStored();
  if (
    stored &&
    stored.token === result.token &&
    stored.userId === ctx.userId &&
    stored.orgId === ctx.orgId
  ) {
    return 'unchanged';
  }
  try {
    await registerPushToken({
      token: result.token,
      platform: result.platform,
      device_id: await deviceId(),
    });
  } catch {
    return 'skipped';
  }
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ token: result.token, userId: ctx.userId, orgId: ctx.orgId })
  );
  return 'registered';
}

export async function unregisterPush(): Promise<void> {
  const stored = await readStored();
  if (!stored) return;
  try {
    await unregisterPushToken({ token: stored.token });
  } catch {
    // Offline or already gone: the backend prunes dead tokens from Expo receipts.
  }
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
