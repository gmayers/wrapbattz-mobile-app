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
      if (cancelled || !data) return;
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
