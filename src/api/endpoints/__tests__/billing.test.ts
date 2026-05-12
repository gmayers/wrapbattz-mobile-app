import { apiClient } from '../../client';
import * as billing from '../billing';

jest.mock('../../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('billing endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /billing/catalog', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: { items: [{ tier_id: 'pro' }] },
    });
    const res = await billing.getCatalog();
    expect(apiClient.get).toHaveBeenCalledWith('/billing/catalog');
    expect(res.items[0].tier_id).toBe('pro');
  });

  it('GET /billing/subscription', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: { source: 'apple_iap', status: 'active' },
    });
    const res = await billing.getSubscription();
    expect(apiClient.get).toHaveBeenCalledWith('/billing/subscription');
    expect(res.status).toBe('active');
  });

  it('POST /billing/iap/verify', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { source: 'apple_iap' } });
    const res = await billing.iapVerify({
      platform: 'ios',
      product_id: 'p',
      transaction_id: 't',
      receipt: 'r',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/billing/iap/verify', {
      platform: 'ios',
      product_id: 'p',
      transaction_id: 't',
      receipt: 'r',
    });
    expect(res.source).toBe('apple_iap');
  });

  it('POST /billing/iap/restore', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { source: null } });
    await billing.iapRestore({ platform: 'ios', receipts: [] });
    expect(apiClient.post).toHaveBeenCalledWith('/billing/iap/restore', {
      platform: 'ios',
      receipts: [],
    });
  });
});
