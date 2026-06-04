import * as ExpoIap from 'expo-iap';
import { iapService } from '../IapService';

describe('IapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    iapService.reset();
  });

  it('initializes the store connection exactly once', async () => {
    await iapService.init();
    await iapService.init();
    expect(ExpoIap.initConnection).toHaveBeenCalledTimes(1);
  });

  it('fetches subscriptions for given product IDs', async () => {
    (ExpoIap.fetchProducts as jest.Mock).mockResolvedValueOnce([
      { id: 'a', displayPrice: '£9.99', title: 'Pro', description: '', currency: 'GBP' },
    ]);
    await iapService.init();
    const products = await iapService.getProducts(['a']);
    expect(ExpoIap.fetchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ skus: ['a'], type: 'subs' }),
    );
    expect(products[0].productId).toBe('a');
    expect(products[0].localizedPrice).toBe('£9.99');
  });

  it('wraps platform errors as IapError', async () => {
    (ExpoIap.fetchProducts as jest.Mock).mockRejectedValueOnce(new Error('store down'));
    await iapService.init();
    await expect(iapService.getProducts(['a'])).rejects.toMatchObject({
      name: 'IapError',
      code: 'store_unavailable',
    });
  });
});
