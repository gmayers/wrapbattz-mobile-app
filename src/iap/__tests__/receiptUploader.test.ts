import * as billingApi from '../../api/endpoints/billing';
import { pendingReceiptStore, PendingReceipt } from '../pendingReceiptStore';
import { uploadReceipt, flushPendingReceipts } from '../receiptUploader';
import { ApiError } from '../../api/errors';

jest.mock('../../api/endpoints/billing');

describe('receiptUploader', () => {
  const receipt: PendingReceipt = {
    platform: 'ios',
    productId: 'com.tooltraq.sub.pro.monthly',
    transactionId: 'tx-1',
    originalTransactionId: 'tx-1',
    receipt: 'r1',
    enqueuedAt: 1,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await pendingReceiptStore.clear();
  });

  it('clears the queue entry on successful verify', async () => {
    (billingApi.iapVerify as jest.Mock).mockResolvedValueOnce({
      source: 'apple_iap',
      status: 'active',
    });
    await pendingReceiptStore.enqueue(receipt);
    const result = await uploadReceipt(receipt);
    expect(result.source).toBe('apple_iap');
    expect(await pendingReceiptStore.list()).toEqual([]);
  });

  it('keeps queue entry on network failure', async () => {
    (billingApi.iapVerify as jest.Mock).mockRejectedValueOnce(
      new ApiError({ code: 'network', message: 'offline' }),
    );
    await pendingReceiptStore.enqueue(receipt);
    await expect(uploadReceipt(receipt)).rejects.toMatchObject({ code: 'network' });
    expect((await pendingReceiptStore.list()).length).toBe(1);
  });

  it('clears queue entry on permanent conflict (subscription_exists)', async () => {
    (billingApi.iapVerify as jest.Mock).mockRejectedValueOnce(
      new ApiError({ code: 'conflict', status: 409, message: 'subscription_exists' }),
    );
    await pendingReceiptStore.enqueue(receipt);
    await expect(uploadReceipt(receipt)).rejects.toBeDefined();
    expect(await pendingReceiptStore.list()).toEqual([]);
  });

  it('flushPendingReceipts iterates and uploads all', async () => {
    (billingApi.iapVerify as jest.Mock).mockResolvedValue({ source: 'apple_iap' });
    await pendingReceiptStore.enqueue(receipt);
    await pendingReceiptStore.enqueue({ ...receipt, transactionId: 'tx-2' });
    await flushPendingReceipts();
    expect(await pendingReceiptStore.list()).toEqual([]);
    expect(billingApi.iapVerify).toHaveBeenCalledTimes(2);
  });
});
