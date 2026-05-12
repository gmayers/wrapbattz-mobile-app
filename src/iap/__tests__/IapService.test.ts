import * as RNIap from 'react-native-iap';
import { iapService } from '../IapService';

describe('IapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    iapService.reset();
  });

  it('initializes the store connection exactly once', async () => {
    await iapService.init();
    await iapService.init();
    expect(RNIap.initConnection).toHaveBeenCalledTimes(1);
  });

  it('fetches subscriptions for given product IDs', async () => {
    (RNIap.getSubscriptions as jest.Mock).mockResolvedValueOnce([
      { productId: 'a', localizedPrice: '£9.99', title: 'Pro' },
    ]);
    await iapService.init();
    const products = await iapService.getProducts(['a']);
    expect(products[0].productId).toBe('a');
    expect(products[0].localizedPrice).toBe('£9.99');
  });

  it('wraps platform errors as IapError', async () => {
    (RNIap.getSubscriptions as jest.Mock).mockRejectedValueOnce(new Error('store down'));
    await iapService.init();
    await expect(iapService.getProducts(['a'])).rejects.toMatchObject({
      name: 'IapError',
      code: 'store_unavailable',
    });
  });
});
