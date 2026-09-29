import { apiClient } from '../../client';
import * as n from '../notifications';

jest.mock('../../client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn() },
}));

describe('notifications endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists with status and cursor, omitting empty params', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { items: [], next_cursor: null, prev_cursor: null } });
    await n.listNotifications({ status: 'unread', cursor: 'abc', limit: 20 });
    expect(apiClient.get).toHaveBeenCalledWith('/account/notifications/', {
      params: { status: 'unread', cursor: 'abc', limit: 20 },
    });
    await n.listNotifications({});
    expect(apiClient.get).toHaveBeenLastCalledWith('/account/notifications/', { params: {} });
  });

  it('unwraps the unread count', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { count: 4 } });
    await expect(n.getUnreadCount()).resolves.toBe(4);
    expect(apiClient.get).toHaveBeenCalledWith('/account/notifications/unread-count/');
  });

  it('marks one and all read', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { id: 3, is_read: true } });
    await n.markNotificationRead(3);
    expect(apiClient.patch).toHaveBeenCalledWith('/account/notifications/3/', { read: true });
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { updated: 7 } });
    await expect(n.markAllNotificationsRead()).resolves.toBe(7);
    expect(apiClient.post).toHaveBeenCalledWith('/account/notifications/mark-all-read/');
  });

  it('reads and writes preferences and policy', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { master: {}, types: [] } });
    (apiClient.put as jest.Mock).mockResolvedValue({ data: { master: {}, types: [] } });
    await n.getNotificationPreferences();
    await n.updateNotificationPreferences({ master: { push: true, email: false }, types: [] } as any);
    await n.getNotificationPolicy();
    await n.updateNotificationPolicy({ digest_minutes: 30 } as any);
    expect(apiClient.get).toHaveBeenCalledWith('/account/notification-preferences/');
    expect(apiClient.put).toHaveBeenCalledWith('/account/notification-preferences/', {
      master: { push: true, email: false }, types: [],
    });
    expect(apiClient.get).toHaveBeenCalledWith('/organizations/me/notification-policy/');
    expect(apiClient.put).toHaveBeenCalledWith('/organizations/me/notification-policy/', { digest_minutes: 30 });
  });
});
