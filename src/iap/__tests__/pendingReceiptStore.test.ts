import { pendingReceiptStore, PendingReceipt } from '../pendingReceiptStore';

describe('pendingReceiptStore', () => {
  beforeEach(async () => {
    await pendingReceiptStore.clear();
  });

  const sample: PendingReceipt = {
    platform: 'ios',
    productId: 'com.tooltraq.sub.pro.monthly',
    transactionId: 'tx-1',
    originalTransactionId: 'tx-1',
    receipt: 'base64==',
    enqueuedAt: 1000,
  };

  it('starts empty', async () => {
    expect(await pendingReceiptStore.list()).toEqual([]);
  });

  it('persists and returns receipts in FIFO order', async () => {
    await pendingReceiptStore.enqueue(sample);
    await pendingReceiptStore.enqueue({ ...sample, transactionId: 'tx-2' });
    const list = await pendingReceiptStore.list();
    expect(list.map((r) => r.transactionId)).toEqual(['tx-1', 'tx-2']);
  });

  it('removes by transactionId', async () => {
    await pendingReceiptStore.enqueue(sample);
    await pendingReceiptStore.remove('ios', 'tx-1');
    expect(await pendingReceiptStore.list()).toEqual([]);
  });

  it('dedupes by (platform, transactionId)', async () => {
    await pendingReceiptStore.enqueue(sample);
    await pendingReceiptStore.enqueue(sample);
    expect((await pendingReceiptStore.list()).length).toBe(1);
  });
});
