import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';
import { iapService } from '../../../../iap';
import * as billingApi from '../../../../api/endpoints/billing';
import { usePurchaseFlow } from '../usePurchaseFlow';

jest.mock('../../../../api/endpoints/billing');

function Probe({ onMount }: { onMount?: (api: ReturnType<typeof usePurchaseFlow>) => void }) {
  const flow = usePurchaseFlow();
  React.useEffect(() => { onMount?.(flow); }, []);
  return (
    <>
      <Text testID="state">{flow.status}</Text>
      <TouchableOpacity testID="buy" onPress={() => flow.purchase('com.tooltraq.sub.pro.monthly')}>
        <Text>buy</Text>
      </TouchableOpacity>
    </>
  );
}

describe('usePurchaseFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(iapService, 'requestSubscription').mockResolvedValue(undefined);
    jest.spyOn(iapService, 'finishTransaction').mockResolvedValue();
    jest.spyOn(iapService, 'subscribe').mockImplementation((onPurchase) => {
      setTimeout(() => onPurchase({
        productId: 'com.tooltraq.sub.pro.monthly',
        transactionId: 'tx-1',
        transactionReceipt: 'r1',
        transactionDate: 1,
        platform: 'ios',
      }), 0);
      return () => {};
    });
  });

  it('transitions through purchasing → verifying → active on success', async () => {
    (billingApi.iapVerify as jest.Mock).mockResolvedValue({ source: 'apple_iap', status: 'active' });
    let captured: any;
    const { getByTestId } = render(<Probe onMount={(f) => (captured = f)} />);
    await act(async () => {
      await captured.purchase('com.tooltraq.sub.pro.monthly');
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(getByTestId('state').props.children).toBe('active');
    expect(iapService.finishTransaction).toHaveBeenCalled();
  });

  it('does NOT finish the transaction on transient verify failure', async () => {
    (billingApi.iapVerify as jest.Mock).mockRejectedValue({ code: 'network', message: 'offline' });
    let captured: any;
    render(<Probe onMount={(f) => (captured = f)} />);
    await act(async () => {
      await captured.purchase('com.tooltraq.sub.pro.monthly');
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(iapService.finishTransaction).not.toHaveBeenCalled();
  });
});
