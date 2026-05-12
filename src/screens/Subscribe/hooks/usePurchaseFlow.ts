import { useCallback, useEffect, useRef, useState } from 'react';
import {
  iapEvents,
  iapService,
  pendingReceiptStore,
  uploadReceipt,
  IapError,
  type IapPurchase,
} from '../../../iap';

export type PurchaseStatus =
  | 'idle'
  | 'purchasing'   // user is in the native sheet
  | 'verifying'    // store returned; backend verify in flight
  | 'active'       // backend confirmed
  | 'pending'      // Android pending purchase; backend will confirm via webhook
  | 'error'
  | 'cancelled';

export interface PurchaseFlowState {
  status: PurchaseStatus;
  errorMessage: string | null;
  purchase: (productId: string) => Promise<void>;
  reset: () => void;
}

export function usePurchaseFlow(): PurchaseFlowState {
  const [status, setStatus] = useState<PurchaseStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentProductId = useRef<string | null>(null);

  useEffect(() => {
    const unsub = iapService.subscribe(
      async (p: IapPurchase) => {
        // Android can deliver a PENDING purchase (cash payment, etc.) with no
        // receipt yet. Don't finishTransaction; backend webhook handles it.
        if (!p.transactionReceipt && p.platform === 'android') {
          setStatus('pending');
          return;
        }
        setStatus('verifying');
        const enqueued = {
          platform: p.platform,
          productId: p.productId,
          transactionId: p.transactionId,
          originalTransactionId: p.originalTransactionId,
          receipt: p.transactionReceipt,
          purchaseToken: p.purchaseToken,
          enqueuedAt: Date.now(),
        };
        await pendingReceiptStore.enqueue(enqueued);
        try {
          await uploadReceipt(enqueued);
          await iapService.finishTransaction(p);
          setStatus('active');
          iapEvents.emit('subscription.changed', {
            source: p.platform === 'ios' ? 'apple_iap' : 'google_iap',
          });
        } catch (e: any) {
          // Permanent errors already stripped by uploadReceipt; transient
          // ones remain queued for the next flush.
          setStatus('error');
          setErrorMessage(e?.message ?? 'Could not verify purchase. We will retry shortly.');
        }
      },
      (err: IapError) => {
        if (err.code === 'user_cancelled') {
          setStatus('cancelled');
          return;
        }
        setStatus('error');
        setErrorMessage(err.message);
      },
    );
    return unsub;
  }, []);

  const purchase = useCallback(async (productId: string) => {
    currentProductId.current = productId;
    setStatus('purchasing');
    setErrorMessage(null);
    iapEvents.emit('purchase.started', { tierId: productId });
    try {
      await iapService.requestSubscription(productId);
    } catch (e: any) {
      if (e instanceof IapError && e.code === 'user_cancelled') {
        setStatus('cancelled');
        return;
      }
      setStatus('error');
      setErrorMessage(e?.message ?? 'Purchase failed.');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { status, errorMessage, purchase, reset };
}
