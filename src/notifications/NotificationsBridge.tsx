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

// Identifies a notification response for dedupe purposes. Prefers the
// response's own identifier (request.identifier + actionIdentifier), which
// uniquely names a single OS-level interaction; falls back to notification_id
// when the identifier isn't available (e.g. in tests, or if a platform ever
// omits it).
function responseKey(response: Notifications.NotificationResponse, data: PushData): string {
  const identifier = response.notification?.request?.identifier;
  if (identifier) return `${identifier}:${response.actionIdentifier}`;
  return `id:${data.notification_id}`;
}

// Cold-start replay (getLastNotificationResponseAsync) must not re-handle a
// response the tap listener already handled live, or a response a prior
// cold-start pass already replayed — but a genuine LIVE tap delivered by the
// response listener is always handled: each tap on a still-visible
// notification is a distinct user action (the user can tap it more than
// once), never a "replay" to be suppressed. So this Set only gates the
// cold-start path; the listener path always handles and just records its key
// here afterward so a later cold-start check for the same response is a
// no-op. Module-level (not a ref) because it must survive the bridge
// unmounting/remounting (e.g. logout -> login) so a stale
// getLastNotificationResponseAsync() value isn't replayed on the next mount.
const handledResponseKeys = new Set<string>();

// Exposed for tests only, so each test file starts from a clean dedupe state.
export function __resetNotificationDedupeForTests(): void {
  handledResponseKeys.clear();
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
    const offTap = addNotificationResponseListener((r) => {
      const data = dataOf(r);
      if (!data) return;
      // Live taps are ALWAYS handled, no dedupe — record the key so a later
      // cold-start replay of this same response is recognized as a duplicate.
      handledResponseKeys.add(responseKey(r, data));
      handleTap(data);
    });

    // Cold start: the app was launched by tapping a notification, before the
    // NavigationContainer finished mounting. Replay it at most once, and only
    // if the tap listener hasn't already handled the same response live.
    let offState: (() => void) | undefined;
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      const data = dataOf(r);
      if (!data || cancelled) return;
      try {
        // Consume it: clear the native "last response" so a future remount
        // (e.g. after logout -> login) doesn't see this same tap again on a
        // real device. Wrapped because it throws UnavailabilityError on
        // platforms/SDK versions without the native method — the key-based
        // dedupe below is what actually prevents the replay either way.
        Notifications.clearLastNotificationResponse();
      } catch {
        // No-op — see comment above.
      }
      const key = responseKey(r, data);
      if (handledResponseKeys.has(key)) return; // already handled live, or already replayed once
      handledResponseKeys.add(key);
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
