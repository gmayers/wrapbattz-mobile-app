import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
} from 'expo-iap';
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

type ExpoSubscription = {
  id: string;
  title?: string;
  description?: string;
  displayPrice?: string;
  currency?: string;
  subscriptionOffers?: Array<{
    offerTokenAndroid?: string;
  }>;
};

type ExpoPurchase = {
  id: string;
  productId: string;
  purchaseState?: 'pending' | 'purchased' | 'unknown';
  transactionDate: number;
  purchaseToken?: string;
  expirationDateIOS?: number;
  environmentIOS?: 'Sandbox' | 'Production';
};

class IapServiceImpl {
  private initialized = false;
  private purchaseSub: { remove: () => void } | null = null;
  private errorSub: { remove: () => void } | null = null;
  // Keeps the raw subscription objects so Android offerToken can be passed on
  // purchase. Cleared on teardown/reset.
  private subscriptionCache = new Map<string, ExpoSubscription>();

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await initConnection();
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
      const result = (await fetchProducts({
        skus: productIds,
        type: 'subs',
      } as any)) as ExpoSubscription[];
      this.subscriptionCache.clear();
      result.forEach((s) => this.subscriptionCache.set(s.id, s));
      return result.map((s) => ({
        productId: s.id,
        localizedPrice: s.displayPrice ?? '',
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
    const cached = this.subscriptionCache.get(productId);
    const offers =
      cached?.subscriptionOffers
        ?.filter((o) => !!o.offerTokenAndroid)
        .map((o) => ({ sku: productId, offerToken: o.offerTokenAndroid! })) ?? [];
    try {
      await requestPurchase({
        request: {
          apple: { sku: productId },
          google: {
            skus: [productId],
            subscriptionOffers: offers,
          },
        },
        type: 'subs',
      } as any);
    } catch (e: any) {
      throw this.wrapPurchaseError(e);
    }
  }

  async getAvailablePurchases(): Promise<IapPurchase[]> {
    try {
      const purchases = (await getAvailablePurchases()) as ExpoPurchase[];
      return purchases.map((p) => this.mapPurchase(p));
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
      await finishTransaction({
        purchase: {
          id: purchase.transactionId,
          productId: purchase.productId,
          purchaseToken: purchase.purchaseToken,
          transactionDate: purchase.transactionDate,
        } as any,
        isConsumable,
      });
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
    this.purchaseSub = purchaseUpdatedListener((p: ExpoPurchase) =>
      onPurchase(this.mapPurchase(p)),
    );
    this.errorSub = purchaseErrorListener((e: any) => onError(this.wrapPurchaseError(e)));
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
    this.subscriptionCache.clear();
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
    this.subscriptionCache.clear();
  }

  private mapPurchase = (p: ExpoPurchase): IapPurchase => {
    const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
    const isPending = p.purchaseState === 'pending';
    // OpenIAP / StoreKit 2: `purchaseToken` is the universal receipt field.
    // - iOS: JWS signed transaction (consumed by App Store Server API).
    // - Android: Play purchase token.
    // Backend's verify endpoint accepts both `receipt` and `purchase_token`;
    // we mirror into `transactionReceipt` on iOS for wire compatibility, and
    // leave it empty on Android pending purchases so usePurchaseFlow can
    // detect that state.
    const token = p.purchaseToken ?? '';
    const transactionReceipt = isPending && platform === 'android' ? '' : token;
    return {
      productId: p.productId,
      transactionId: p.id,
      transactionReceipt,
      purchaseToken: token || undefined,
      transactionDate: p.transactionDate,
      platform,
    };
  };

  private wrapPurchaseError(e: any): IapError {
    const code: string | undefined = e?.code;
    if (code === ErrorCode.UserCancelled || code === 'user-cancelled' || code === 'E_USER_CANCELLED') {
      return new IapError({ code: 'user_cancelled', message: 'Purchase cancelled.' });
    }
    if (code === ErrorCode.AlreadyOwned || code === 'already-owned' || code === 'E_ALREADY_OWNED') {
      return new IapError({ code: 'already_owned', message: 'Product already owned.' });
    }
    if (code === ErrorCode.NetworkError || code === 'network-error') {
      return new IapError({ code: 'network', message: 'Network error.', cause: e });
    }
    return new IapError({
      code: 'unknown',
      message: e?.message ?? 'Purchase failed.',
      cause: e,
    });
  }
}

export const iapService = new IapServiceImpl();
