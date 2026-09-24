import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import * as api from '../../api/endpoints/notifications';
import { navigationRef } from '../../navigation/navigationRef';
import NotificationsBridge, { __resetNotificationDedupeForTests } from '../NotificationsBridge';

jest.mock('../../api/endpoints/notifications', () => ({ markNotificationRead: jest.fn(async () => ({})) }));
jest.mock('../usePushRegistration', () => ({ usePushRegistration: jest.fn() }));

const mockAuth = jest.fn(() => ({ isAdminOrOwner: false, onboardingComplete: true }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => mockAuth() }));

jest.mock('../../navigation/navigationRef', () => {
  const ref: any = { isReady: jest.fn(() => true), navigate: jest.fn(), addListener: jest.fn(() => jest.fn()) };
  return { navigationRef: ref };
});

const response = (data: any) => ({ notification: { request: { content: { data } } } });

// gcTime: Infinity + staleTime: 0 avoids leaving real gc/refetch timers on the
// query cache after the test's observers unmount (see task-5 findings) —
// otherwise Jest hangs waiting for the process to exit.
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, staleTime: 0, retry: false },
      mutations: { gcTime: Infinity },
    },
  });
}

function renderBridge() {
  const client = makeClient();
  const spy = jest.spyOn(client, 'invalidateQueries');
  const utils = render(
    <QueryClientProvider client={client}>
      <NotificationsBridge />
    </QueryClientProvider>
  );
  return { spy, ...utils };
}

describe('NotificationsBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // notification_id-based dedupe is a module-level singleton by design (it
    // must survive the bridge unmounting/remounting on a real device — see
    // NotificationsBridge.tsx) — reset it between tests so cases reusing the
    // same notification_id (e.g. 9) don't see each other's state.
    __resetNotificationDedupeForTests();
    mockAuth.mockReturnValue({ isAdminOrOwner: false, onboardingComplete: true });
    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
    // mockResolvedValue sets a persistent implementation that survives
    // clearAllMocks() (which only clears calls/instances, not the
    // implementation) — reset it explicitly so a test that configures a
    // cold-start response doesn't leak it into the next test.
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);
  });

  it('installs the foreground handler', () => {
    renderBridge();
    expect(Notifications.setNotificationHandler).toHaveBeenCalled();
  });

  it('refreshes notification queries when a push arrives', () => {
    const { spy } = renderBridge();
    const onReceive = (Notifications.addNotificationReceivedListener as jest.Mock).mock.calls[0][0];
    onReceive({});
    expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('tap marks read and opens the tool', async () => {
    renderBridge();
    const onTap = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
    onTap(response({ notification_id: 9, link: { kind: 'tool', id: 4 } }));
    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalledWith(9));
    expect(navigationRef.navigate).toHaveBeenCalledWith('DeviceDetails', { deviceId: 4 });
  });

  it('tap with no link opens inbox', () => {
    renderBridge();
    const onTap = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
    onTap(response({ notification_id: 9, link: null }));
    expect(navigationRef.navigate).toHaveBeenCalledWith('Notifications', undefined);
  });

  it('cold start replays once when ready', async () => {
    (navigationRef.isReady as jest.Mock).mockReturnValue(false);
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      response({ notification_id: 1, link: { kind: 'tool', id: 2 } })
    );
    renderBridge();
    await waitFor(() => expect(navigationRef.addListener).toHaveBeenCalledWith('state', expect.any(Function)));
    const onState = (navigationRef.addListener as jest.Mock).mock.calls[0][1];
    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
    onState();
    onState();
    expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
  });

  // Controller ruling: Notifications/DeviceDetails/Members only exist once
  // OnboardingStack has finished onboarding (src/navigation/index.tsx). A tap
  // arriving before that would navigate to a route that isn't mounted, so the
  // bridge must mark the notification read but skip navigation until then.
  it('does not navigate before onboarding is complete, but still marks read', async () => {
    mockAuth.mockReturnValue({ isAdminOrOwner: false, onboardingComplete: false });
    renderBridge();
    const onTap = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
    onTap(response({ notification_id: 9, link: { kind: 'tool', id: 4 } }));
    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalledWith(9));
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  // Review finding: expo-notifications' "last response" is a process-lifetime
  // native value, not scoped to this component's mount. The bridge itself
  // remounts across logout -> login, so if getLastNotificationResponseAsync()
  // still resolves the same (already-handled) response on the next mount —
  // e.g. because the native clear hasn't taken effect, exactly what the mock
  // simulates here — it must not be replayed a second time.
  it('does not replay the same notification response across an unmount/remount', async () => {
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      response({ notification_id: 5, link: { kind: 'tool', id: 6 } })
    );
    const first = renderBridge();
    await waitFor(() => expect(navigationRef.navigate).toHaveBeenCalledTimes(1));
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
    first.unmount();

    renderBridge();
    // Give the second mount's getLastNotificationResponseAsync().then(...)
    // a chance to run — it resolves the same stale response again.
    await waitFor(() => expect(Notifications.getLastNotificationResponseAsync).toHaveBeenCalledTimes(2));

    expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
    expect(api.markNotificationRead).toHaveBeenCalledTimes(1);
  });

  // Review finding: the same response can be delivered to both the tap
  // listener and getLastNotificationResponseAsync() within a single mount
  // (e.g. a tap that both fires the response listener and is still the "last
  // response" the cold-start check reads). It must only be handled once.
  it('handles a response delivered to both the tap listener and cold-start replay only once', async () => {
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      response({ notification_id: 7, link: { kind: 'tool', id: 8 } })
    );
    renderBridge();
    const onTap = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
    onTap(response({ notification_id: 7, link: { kind: 'tool', id: 8 } }));

    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalledTimes(1));
    // Flush the pending cold-start replay too before asserting the final count.
    await waitFor(() => expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled());
    expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
    expect(api.markNotificationRead).toHaveBeenCalledTimes(1);
  });

  it('removes both listener subscriptions on unmount', () => {
    const { unmount } = renderBridge();
    const receivedRemove = (Notifications.addNotificationReceivedListener as jest.Mock).mock.results[0].value
      .remove;
    const responseRemove = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.results[0]
      .value.remove;
    unmount();
    expect(receivedRemove).toHaveBeenCalledTimes(1);
    expect(responseRemove).toHaveBeenCalledTimes(1);
  });
});
