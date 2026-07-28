import React from 'react';
import { render, act } from '@testing-library/react-native';
import { iapService } from '../../../iap';
import * as billingApi from '../../../api/endpoints/billing';
import SubscribeScreen from '../SubscribeScreen';

jest.mock('../../../api/endpoints/billing');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      surfaceAlt: '#161616',
      border: '#333',
      primary: '#FFB300',
      textPrimary: '#fff',
      textSecondary: '#aaa',
      textMuted: '#888',
      disabled: '#444',
    },
  }),
}));

const flush = async (times = 1) => {
  for (let i = 0; i < times; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

describe('SubscribeScreen', () => {
  let onPurchase: (p: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    (billingApi.getCatalog as jest.Mock).mockResolvedValue({ items: [] });
    (billingApi.getSubscription as jest.Mock).mockImplementation(() =>
      Promise.resolve({ source: 'apple_iap', status: 'active', tier_id: 'pro' }),
    );
    (billingApi.iapVerify as jest.Mock).mockResolvedValue({
      source: 'apple_iap',
      status: 'active',
    });
    jest.spyOn(iapService, 'init').mockResolvedValue();
    jest.spyOn(iapService, 'getProducts').mockResolvedValue([]);
    jest.spyOn(iapService, 'requestSubscription').mockResolvedValue(undefined);
    jest.spyOn(iapService, 'finishTransaction').mockResolvedValue();
    jest.spyOn(iapService, 'subscribe').mockImplementation((cb: any) => {
      onPurchase = cb;
      return () => {};
    });
  });

  it('does not refetch the subscription in a loop after a purchase completes', async () => {
    render(<SubscribeScreen />);
    await act(async () => {
      await flush(3);
    });
    const callsAfterMount = (billingApi.getSubscription as jest.Mock).mock.calls.length;

    // Complete a purchase: usePurchaseFlow verifies it, sets status 'active',
    // and emits subscription.changed (which useSubscription refreshes on).
    await act(async () => {
      onPurchase({
        productId: 'com.tooltraq.sub.pro.monthly',
        transactionId: 'tx-1',
        transactionReceipt: 'r1',
        transactionDate: 1,
        platform: 'ios',
      });
      // Give a runaway effect plenty of render/resolve cycles to expose itself.
      await flush(20);
    });

    const callsAfterPurchase =
      (billingApi.getSubscription as jest.Mock).mock.calls.length - callsAfterMount;
    expect(callsAfterPurchase).toBeLessThanOrEqual(1);
  });
});
