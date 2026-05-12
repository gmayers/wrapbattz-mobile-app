import { iapVerify } from '../api/endpoints/billing';
import { ApiError } from '../api/errors';
import type { SubscriptionState } from '../api/types-billing';
import { pendingReceiptStore, PendingReceipt } from './pendingReceiptStore';
import { IapError } from './errors';

// Codes that mean "this receipt is permanently unprocessable; stop retrying."
// Other errors (network, server) leave the receipt in the queue for later flush.
const PERMANENT_API_CODES = new Set(['conflict', 'validation', 'forbidden', 'not_found']);

export async function uploadReceipt(receipt: PendingReceipt): Promise<SubscriptionState> {
  try {
    const state = await iapVerify({
      platform: receipt.platform,
      product_id: receipt.productId,
      transaction_id: receipt.transactionId,
      original_transaction_id: receipt.originalTransactionId,
      receipt: receipt.receipt,
      purchase_token: receipt.purchaseToken,
    });
    await pendingReceiptStore.remove(receipt.platform, receipt.transactionId);
    return state;
  } catch (e) {
    if (e instanceof ApiError && PERMANENT_API_CODES.has(e.code)) {
      await pendingReceiptStore.remove(receipt.platform, receipt.transactionId);
      throw new IapError({
        code: e.code === 'conflict' ? 'conflict' : 'validation_failed',
        message: e.message,
        cause: e,
      });
    }
    throw e;
  }
}

export async function flushPendingReceipts(): Promise<void> {
  const list = await pendingReceiptStore.list();
  for (const r of list) {
    try {
      await uploadReceipt(r);
    } catch (e) {
      // Permanent errors are stripped from the queue inside uploadReceipt;
      // transient ones stay queued and are retried on the next flush.
      console.warn('[receiptUploader] flush retry skipped:', e);
    }
  }
}
