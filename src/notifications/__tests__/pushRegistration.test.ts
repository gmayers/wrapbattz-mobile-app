import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NotificationService from '../../services/NotificationService';
import * as account from '../../api/endpoints/account';
import { syncPushRegistration, unregisterPush } from '../pushRegistration';

jest.mock('../../services/NotificationService', () => ({ registerForPush: jest.fn() }));
jest.mock('../../api/endpoints/account', () => ({
  registerPushToken: jest.fn(async () => ({})),
  unregisterPushToken: jest.fn(async () => undefined),
}));

const store: Record<string, string> = {};
beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(store)) delete store[k];
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => store[k] ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => { store[k] = v; });
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (k: string) => { delete store[k]; });
});

const granted = { token: 'ExponentPushToken[a]', platform: 'ios', status: 'granted' };

describe('syncPushRegistration', () => {
  it('registers the token with platform and device id', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('registered');
    expect(account.registerPushToken).toHaveBeenCalledWith({
      token: 'ExponentPushToken[a]', platform: 'ios', device_id: expect.any(String),
    });
  });

  it('does not re-post an unchanged token for the same user and org', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await syncPushRegistration({ userId: 1, orgId: 2 });
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('unchanged');
    expect(account.registerPushToken).toHaveBeenCalledTimes(1);
  });

  it('re-posts after an org switch', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await syncPushRegistration({ userId: 1, orgId: 2 });
    await syncPushRegistration({ userId: 1, orgId: 3 });
    expect(account.registerPushToken).toHaveBeenCalledTimes(2);
  });

  it('skips when permission denied', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue({ token: null, platform: 'ios', status: 'denied' });
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('skipped');
    expect(account.registerPushToken).not.toHaveBeenCalled();
  });

  it('skips when no token (simulator/web)', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue({ token: null, platform: 'web', status: 'granted' });
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('skipped');
  });

  it('skips and does not cache when the POST fails', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    (account.registerPushToken as jest.Mock).mockRejectedValueOnce(new Error('network'));
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('skipped');
    await expect(syncPushRegistration({ userId: 1, orgId: 2 })).resolves.toBe('registered');
  });
});

describe('unregisterPush', () => {
  it('deletes the cached token and clears the cache', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await syncPushRegistration({ userId: 1, orgId: 2 });
    await unregisterPush();
    expect(account.unregisterPushToken).toHaveBeenCalledWith({ token: 'ExponentPushToken[a]' });
    expect(store['notifications.pushRegistration.v1']).toBeUndefined();
  });

  it('never throws', async () => {
    (NotificationService.registerForPush as jest.Mock).mockResolvedValue(granted);
    await syncPushRegistration({ userId: 1, orgId: 2 });
    (account.unregisterPushToken as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(unregisterPush()).resolves.toBeUndefined();
  });

  it('does nothing when nothing was registered', async () => {
    await unregisterPush();
    expect(account.unregisterPushToken).not.toHaveBeenCalled();
  });
});
