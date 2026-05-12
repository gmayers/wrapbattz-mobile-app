import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  flushFailedPurchasesCachedAsPendingAndroid,
} from 'react-native-iap';
import { Platform } from 'react-native';
import { IapError } from './errors';

export interface IapProduct {
  productId: string;
  localizedPrice: string;
  title: string;
  description: string;
  currency: string;
}

export interface IapPurchase {
  productId: string;
  transactionId: string;
  originalTransactionId?: string;
  transactionReceipt: string;
  purchaseToken?: string;
  transactionDate: number;
  platform: 'ios' | 'android';
}

class IapServiceImpl {
  private initialized = false;
  private purchaseSub: { remove: () => void } | null = null;
  private errorSub: { remove: () => void } | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await initConnection();
      if (Platform.OS === 'android') {
        try {
          await flushFailedPurchasesCachedAsPendingAndroid();
        } catch {
          /* best effort */
        }
      }
      this.initialized = true;
    } catch (e) {
      throw new IapError({
        code: 'store_unavailable',
        message: 'Could not connect to the store.',
        cause: e,
      });
    }
  }

  async getProducts(productIds: string[]): Promise<IapProduct[]> {
    if (productIds.length === 0) return [];
    try {
      const subs = await getSubscriptions({ skus: productIds } as any);
      return (subs as any[]).map((s) => ({
        productId: s.productId,
        localizedPrice: s.localizedPrice ?? '',
        title: s.title ?? '',
        description: s.description ?? '',
        currency: s.currency ?? '',
      }));
    } catch (e) {
      throw new IapError({
        code: 'store_unavailable',
        message: 'Could not fetch products.',
        cause: e,
      });
    }
  }

  async requestSubscription(productId: string): Promise<void> {
    try {
      await requestSubscription({ sku: productId } as any);
    } catch (e: any) {
      if (e?.code === 'E_USER_CANCELLED') {
        throw new IapError({ code: 'user_cancelled', message: 'Purchase cancelled.' });
      }
      if (e?.code === 'E_ALREADY_OWNED') {
        throw new IapError({ code: 'already_owned', message: 'Product already owned.' });
      }
      throw new IapError({
        code: 'unknown',
        message: e?.message ?? 'Purchase failed.',
        cause: e,
      });
    }
  }

  async getAvailablePurchases(): Promise<IapPurchase[]> {
    try {
      const purchases = (await getAvailablePurchases()) as any[];
      return purchases.map(this.mapPurchase);
    } catch (e) {
      throw new IapError({
        code: 'store_unavailable',
        message: 'Could not retrieve purchases.',
        cause: e,
      });
    }
  }

  async finishTransaction(purchase: IapPurchase, isConsumable = false): Promise<void> {
    try {
      await finishTransaction({ purchase: purchase as any, isConsumable } as any);
    } catch (e) {
      throw new IapError({
        code: 'unknown',
        message: 'Could not finish transaction.',
        cause: e,
      });
    }
  }

  /**
   * Subscribes to purchase / error events from the store. Returns an unsubscribe.
   * The orchestration layer (usePurchaseFlow) decides what to do with each event.
   */
  subscribe(
    onPurchase: (p: IapPurchase) => void,
    onError: (e: IapError) => void,
  ): () => void {
    this.purchaseSub = purchaseUpdatedListener((p: any) => onPurchase(this.mapPurchase(p)));
    this.errorSub = purchaseErrorListener((e: any) => {
      const code = e?.code === 'E_USER_CANCELLED' ? 'user_cancelled' : 'unknown';
      onError(new IapError({ code: code as any, message: e?.message ?? 'Purchase error.', cause: e }));
    });
    return () => {
      this.purchaseSub?.remove();
      this.errorSub?.remove();
      this.purchaseSub = null;
      this.errorSub = null;
    };
  }

  async teardown(): Promise<void> {
    this.purchaseSub?.remove();
    this.errorSub?.remove();
    this.purchaseSub = null;
    this.errorSub = null;
    if (this.initialized) {
      try { await endConnection(); } catch { /* no-op */ }
      this.initialized = false;
    }
  }

  /** Test-only. */
  reset(): void {
    this.initialized = false;
    this.purchaseSub = null;
    this.errorSub = null;
  }

  private mapPurchase = (p: any): IapPurchase => ({
    productId: p.productId,
    transactionId: p.transactionId,
    originalTransactionId: p.originalTransactionIdentifierIOS ?? p.originalTransactionId,
    transactionReceipt: p.transactionReceipt ?? '',
    purchaseToken: p.purchaseTokenAndroid ?? p.purchaseToken,
    transactionDate: p.transactionDate,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
}

export const iapService = new IapServiceImpl();
