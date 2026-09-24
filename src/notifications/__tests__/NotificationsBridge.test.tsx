import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import * as api from '../../api/endpoints/notifications';
import { navigationRef } from '../../navigation/navigationRef';
import NotificationsBridge from '../NotificationsBridge';

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
  render(
    <QueryClientProvider client={client}>
      <NotificationsBridge />
    </QueryClientProvider>
  );
  return spy;
}

describe('NotificationsBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue({ isAdminOrOwner: false, onboardingComplete: true });
    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
  });

  it('installs the foreground handler', () => {
    renderBridge();
    expect(Notifications.setNotificationHandler).toHaveBeenCalled();
  });

  it('refreshes notification queries when a push arrives', () => {
    const spy = renderBridge();
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
});
