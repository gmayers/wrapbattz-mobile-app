import * as SecureStore from 'expo-secure-store';

const KEY = 'iap.pendingReceipts.v1';

export interface PendingReceipt {
  platform: 'ios' | 'android';
  productId: string;
  transactionId: string;
  originalTransactionId?: string;
  receipt: string;
  purchaseToken?: string;
  enqueuedAt: number;
}

async function readAll(): Promise<PendingReceipt[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(list: PendingReceipt[]): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(list));
}

export const pendingReceiptStore = {
  async list(): Promise<PendingReceipt[]> {
    return readAll();
  },

  async enqueue(receipt: PendingReceipt): Promise<void> {
    const list = await readAll();
    if (
      list.some(
        (r) => r.platform === receipt.platform && r.transactionId === receipt.transactionId,
      )
    ) {
      return;
    }
    list.push(receipt);
    await writeAll(list);
  },

  async remove(platform: PendingReceipt['platform'], transactionId: string): Promise<void> {
    const list = await readAll();
    const next = list.filter(
      (r) => !(r.platform === platform && r.transactionId === transactionId),
    );
    if (next.length !== list.length) await writeAll(next);
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
  },
};
