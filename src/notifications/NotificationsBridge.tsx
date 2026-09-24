// Installs Expo notification handlers for a signed-in session and routes taps.
// Renders nothing. Mounted by AppNavigator whenever a user is authenticated
// (see src/navigation/index.tsx), regardless of onboarding state — but the
// tap handler below only navigates once onboarding is complete, since the
// Notifications/DeviceDetails/Members routes don't exist in OnboardingStack
// until then.
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  configureForegroundHandler,
} from '../services/NotificationService';
import { markNotificationRead } from '../api/endpoints/notifications';
import { useAuth } from '../auth/AuthContext';
import { navigationRef } from '../navigation/navigationRef';
import { navigateToLink, type NotificationLinkLike } from './linkRouting';
import { notificationKeys } from './queries';
import { usePushRegistration } from './usePushRegistration';

interface PushData {
  notification_id?: number;
  link?: NotificationLinkLike;
}

function dataOf(response: Notifications.NotificationResponse | null | undefined): PushData | null {
  const data = response?.notification?.request?.content?.data as PushData | undefined;
  return data ?? null;
}

// expo-notifications' "last response" (getLastNotificationResponseAsync) is a
// process-lifetime native value, not tied to this component's mount. The
// bridge itself remounts across logout -> login, and calling
// clearLastNotificationResponse() after consuming it is not guaranteed to
// take effect before a remount reads it again (and never takes effect in
// tests, where it's just a jest.fn()). Keying dedupe on notification_id
// (rather than response object identity) also covers the case where the same
// tap reaches BOTH the response listener and getLastNotificationResponseAsync
// within one mount. This is intentionally a module-level singleton — not a
// ref — so it survives the bridge unmounting and remounting.
let lastHandledNotificationId: number | undefined;

// Exposed for tests only, so each test file starts from a clean dedupe state.
export function __resetNotificationDedupeForTests(): void {
  lastHandledNotificationId = undefined;
}

export default function NotificationsBridge(): null {
  const qc = useQueryClient();
  const { isAdminOrOwner, onboardingComplete } = useAuth();
  // Tap handling happens inside listeners set up once (empty effect deps
  // below), so route decisions read the latest auth state via this ref
  // instead of closing over stale values.
  const opts = useRef({ isAdminOrOwner, onboardingComplete });
  opts.current = { isAdminOrOwner, onboardingComplete };

  usePushRegistration();

  useEffect(() => {
    configureForegroundHandler();

    const handleTap = (data: PushData | null) => {
      if (!data) return;
      if (data.notification_id != null) {
        // Same logical notification already handled (via the listener, a
        // prior cold-start replay, or a stale getLastNotificationResponseAsync
        // value surviving a remount) — never mark-read/navigate twice for it.
        if (data.notification_id === lastHandledNotificationId) return;
        lastHandledNotificationId = data.notification_id;
        void markNotificationRead(data.notification_id)
          .catch(() => undefined)
          .finally(() => qc.invalidateQueries({ queryKey: notificationKeys.all }));
      }
      // Notifications/DeviceDetails/Members only exist once OnboardingStack
      // has switched to MainStack (src/navigation/index.tsx). Before that,
      // just mark the notification read and skip navigation.
      if (!opts.current.onboardingComplete) return;
      navigateToLink(data.link, opts.current);
    };

    const offReceive = addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    });
    const offTap = addNotificationResponseListener((r) => handleTap(dataOf(r)));

    // Cold start: the app was launched by tapping a notification, before the
    // NavigationContainer finished mounting. Wait for it to become ready,
    // then replay the tap exactly once.
    let offState: (() => void) | undefined;
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      const data = dataOf(r);
      if (!data) return;
      // Consume it: clear the native "last response" so a future remount
      // (e.g. after logout -> login) doesn't see this same tap again on a
      // real device. The notification_id dedupe above is the safety net for
      // when clearing hasn't taken effect yet, or in tests where this call is
      // a no-op mock.
      Notifications.clearLastNotificationResponse();
      if (cancelled) return;
      if (navigationRef.isReady()) {
        handleTap(data);
        return;
      }
      let done = false;
      offState = navigationRef.addListener('state', () => {
        if (done || !navigationRef.isReady()) return;
        done = true;
        handleTap(data);
        offState?.();
      });
    });

    return () => {
      cancelled = true;
      offReceive();
      offTap();
      offState?.();
    };
  }, [qc]);

  return null;
}
