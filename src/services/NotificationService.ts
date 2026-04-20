// src/services/NotificationService.ts
//
// Thin wrapper around expo-notifications so hooks/tests have a single, mockable
// surface for permission checks, Expo push-token retrieval, and listener setup.
// All external notification logic in the app should go through this module —
// don't import `expo-notifications` directly elsewhere.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface PushRegistrationResult {
  token: string | null;
  platform: 'ios' | 'android' | 'web';
  status: NotificationPermissionStatus;
  error?: string;
}

// The Android channel id we route general device/assignment notifications through.
// Backends sending push via Expo can target this with `channelId: 'default'`.
const DEFAULT_CHANNEL_ID = 'default';

/**
 * Read the current notifications permission without prompting.
 */
export async function getPermissionStatus(): Promise<NotificationPermissionStatus> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch (err) {
    console.warn('[NotificationService] getPermissionStatus failed:', err);
    return 'undetermined';
  }
}

/**
 * Ask the user for permission if not already granted. Safe to call repeatedly —
 * the OS only shows the prompt once; subsequent calls resolve to the stored status.
 */
export async function requestPermission(): Promise<NotificationPermissionStatus> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return 'granted';
    // iOS: Can't re-prompt once denied; the returned status will just be 'denied'.
    const next = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: false,
      },
    });
    if (next.status === 'granted') return 'granted';
    if (next.status === 'denied') return 'denied';
    return 'undetermined';
  } catch (err) {
    console.warn('[NotificationService] requestPermission failed:', err);
    return 'undetermined';
  }
}

/**
 * Ensure the Android "default" notification channel exists. No-op on iOS.
 * Channels are required on Android 8+ to show notifications; calling this at
 * startup means the channel is ready whenever a push arrives.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFC72C',
    });
  } catch (err) {
    console.warn('[NotificationService] ensureAndroidChannel failed:', err);
  }
}

/**
 * Retrieve an Expo push token for this device. Returns null on simulators,
 * web, or when permission isn't granted.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    // Expo push tokens don't work on simulators/emulators — the backend can't target them.
    console.log('[NotificationService] Skipping token fetch on simulator/emulator');
    return null;
  }
  try {
    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId ||
      (Constants as any)?.manifest2?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResponse?.data ?? null;
  } catch (err) {
    console.warn('[NotificationService] getExpoPushToken failed:', err);
    return null;
  }
}

/**
 * Set the default foreground notification handler. Call once at app start.
 * By default we surface alerts, sound, and badges even when the app is open —
 * most battwrapz pushes are operational (assignment, device issue) and should
 * be visible regardless of foreground state.
 */
export function configureForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type NotificationReceivedCallback = (notification: Notifications.Notification) => void;
export type NotificationResponseCallback = (response: Notifications.NotificationResponse) => void;

/**
 * Subscribe to incoming notifications (foreground). Returns an unsubscribe function.
 */
export function addNotificationReceivedListener(cb: NotificationReceivedCallback): () => void {
  const sub = Notifications.addNotificationReceivedListener(cb);
  return () => sub.remove();
}

/**
 * Subscribe to notification-taps (user interaction with a delivered notification).
 * Returns an unsubscribe function.
 */
export function addNotificationResponseListener(cb: NotificationResponseCallback): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(cb);
  return () => sub.remove();
}

/**
 * Run a full registration flow: request permission, create Android channel, fetch token.
 * Returns a structured result so callers can branch on status without try/catch.
 */
export async function registerForPush(): Promise<PushRegistrationResult> {
  const platform: 'ios' | 'android' | 'web' =
    Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

  const status = await requestPermission();
  if (status !== 'granted') {
    return { token: null, platform, status };
  }

  await ensureAndroidChannel();

  const token = await getExpoPushToken();
  if (!token) {
    return {
      token: null,
      platform,
      status: 'granted',
      error: 'Could not obtain an Expo push token on this device.',
    };
  }

  return { token, platform, status: 'granted' };
}
