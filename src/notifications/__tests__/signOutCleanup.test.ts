import * as Notifications from 'expo-notifications';
import { clearNotificationStateOnSignOut } from '../signOutCleanup';

describe('clearNotificationStateOnSignOut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
  });

  it('dismisses delivered notifications, clears the last response and zeroes the badge', async () => {
    await clearNotificationStateOnSignOut();
    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
  });

  it('never throws when the native calls reject or throw', async () => {
    (Notifications.dismissAllNotificationsAsync as jest.Mock).mockRejectedValueOnce(new Error('x'));
    (Notifications.setBadgeCountAsync as jest.Mock).mockRejectedValueOnce(new Error('y'));
    (Notifications.clearLastNotificationResponse as jest.Mock).mockImplementationOnce(() => {
      throw new Error('UnavailabilityError');
    });
    await expect(clearNotificationStateOnSignOut()).resolves.toBeUndefined();
  });
});
