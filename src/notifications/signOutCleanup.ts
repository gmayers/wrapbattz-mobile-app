// Local notification state that must not outlive a session: delivered
// notifications in the tray, the native "last response" (cold-start tap) and
// the app icon badge. Run on every sign-out path so a shared device doesn't
// show the previous user's alerts. Best-effort — never throws or rejects.
import {
  clearLastResponse,
  dismissAllNotifications,
  setBadgeCount,
} from '../services/NotificationService';

export async function clearNotificationStateOnSignOut(): Promise<void> {
  try {
    await Promise.all([dismissAllNotifications(), clearLastResponse(), setBadgeCount(0)]);
  } catch {
    // The wrappers never throw; belt and braces for the sign-out paths.
  }
}
