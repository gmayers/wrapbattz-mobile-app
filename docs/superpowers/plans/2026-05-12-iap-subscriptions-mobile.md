# IAP Subscriptions — Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app purchase support to the React Native app (Apple StoreKit + Google Play Billing) so org owners can subscribe from mobile. Backend is the source of truth; this plan implements the mobile-side machinery only.

**Architecture:** New `src/iap/` module wraps `react-native-iap`, owns a persisted pending-receipt queue, and uploads receipts to a backend `/billing/iap/verify` endpoint that mints the actual entitlement. Subscription state is always read from `GET /billing/subscription` — the mobile app never trusts a raw receipt. A new `SubscribeScreen` renders tiers fetched from `/billing/catalog`.

**Tech Stack:** TypeScript, react-native-iap, axios via existing `apiClient`, SecureStore for persistence, React Navigation v7, Jest for unit tests.

**Spec:** [docs/superpowers/specs/2026-05-12-iap-subscriptions-design.md](../specs/2026-05-12-iap-subscriptions-design.md)

**Out of scope:**
- Backend endpoints (separate plan: `2026-05-12-iap-subscriptions-backend.md` — handoff doc for backend team).
- Migration of existing Stripe metered customers (grandfathered, backend-only concern).
- Existing `PricingScreen.js` (kept for pre-register marketing flow).
- `BillingService.ts` refactor (marked deprecated; new code uses `src/api/endpoints/billing.ts` + `src/iap/` directly).

---

## File Structure

**New files:**
- `src/iap/errors.ts` — typed `IapError` class
- `src/iap/events.ts` — purchase lifecycle event bus
- `src/iap/pendingReceiptStore.ts` — SecureStore-backed receipt queue
- `src/iap/IapService.ts` — singleton wrapper over `react-native-iap`
- `src/iap/receiptUploader.ts` — backend verify + retry
- `src/iap/productCatalog.ts` — fetches `/billing/catalog`, maps tier_id → product_id
- `src/iap/index.ts` — public surface
- `src/api/endpoints/billing.ts` — catalog, subscription, iap.verify, iap.restore
- `src/api/types-billing.ts` — types for catalog, subscription, iap payloads (not in OpenAPI yet)
- `src/screens/Subscribe/SubscribeScreen.tsx`
- `src/screens/Subscribe/hooks/useSubscription.ts`
- `src/screens/Subscribe/hooks/usePurchaseFlow.ts`

**Modified files:**
- `package.json` — add `react-native-iap`
- `app.json` (or `app.config.ts`) — Android billing permission + iOS in-app-purchase capability hint
- `src/api/endpoints/index.ts` — re-export `billing`
- `src/navigation/index.tsx` — register `Subscribe` route
- `src/screens/Settings/sections.ts` — add Subscription row
- `src/screens/PaymentScreens/ManageBillingScreen.js` — branch on `subscription.source` for IAP-sourced subs
- `App.tsx` — initialize IAP module at app start

---

## Phase 0 — Setup

### Task 1: Install `react-native-iap` and configure native projects

**Files:**
- Modify: `package.json`
- Modify: `app.json` (or `app.config.ts`)

- [ ] **Step 1: Install the package**

Run:
```bash
npx expo install react-native-iap
```

Expected: `react-native-iap` added to `package.json` dependencies. Note the installed version.

- [ ] **Step 2: Add Android `BILLING` permission and config plugin**

Check whether the project uses `app.json` or `app.config.ts`:
```bash
ls /home/garan/Documents/programming/live-projects/wrapbattz2/app/wrapbattz/app.json /home/garan/Documents/programming/live-projects/wrapbattz2/app/wrapbattz/app.config.ts 2>/dev/null
```

In `app.json` under `expo.android.permissions`, add `"com.android.vending.BILLING"`. In `expo.plugins`, add `"react-native-iap"`.

Example diff in `app.json`:
```json
{
  "expo": {
    "android": {
      "permissions": ["com.android.vending.BILLING", ...]
    },
    "plugins": ["react-native-iap", ...]
  }
}
```

- [ ] **Step 3: Apply native config**

The repo already has `ios/` and `android/` directories from prior EAS builds. Do **not** run `expo prebuild --clean` — it wipes local native customizations. Choose one:

**Option A (preferred if no native customizations):** Run a non-destructive prebuild:
```bash
npx expo prebuild --no-install
```
This will offer to merge into the existing native directories — review the diff before accepting.

**Option B (always safe):** Add the permission and pod manually.

For Android, edit `android/app/src/main/AndroidManifest.xml` and add inside `<manifest>`:
```xml
<uses-permission android:name="com.android.vending.BILLING" />
```

For iOS, run pod install to pick up the new library:
```bash
cd ios && pod install && cd ..
```

- [ ] **Step 4: Verify Android permission landed**

Run:
```bash
grep "com.android.vending.BILLING" android/app/src/main/AndroidManifest.xml
```

Expected: one match.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json ios android
git commit -m "feat(iap): add react-native-iap dependency and native config"
```

---

## Phase 1 — Core IAP module

### Task 2: `IapError` class

**Files:**
- Create: `src/iap/errors.ts`
- Test: `src/iap/__tests__/errors.test.ts`

- [ ] **Step 1: Write the failing test**

`src/iap/__tests__/errors.test.ts`:
```typescript
import { IapError } from '../errors';

describe('IapError', () => {
  it('exposes code and message', () => {
    const err = new IapError({ code: 'user_cancelled', message: 'cancelled' });
    expect(err.code).toBe('user_cancelled');
    expect(err.message).toBe('cancelled');
    expect(err).toBeInstanceOf(Error);
  });

  it('round-trips the platform original error', () => {
    const orig = new Error('boom');
    const err = new IapError({ code: 'unknown', message: 'wrap', cause: orig });
    expect(err.cause).toBe(orig);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npx jest src/iap/__tests__/errors.test.ts
```
Expected: FAIL — cannot find module `../errors`.

- [ ] **Step 3: Implement `IapError`**

`src/iap/errors.ts`:
```typescript
export type IapErrorCode =
  | 'not_initialized'
  | 'store_unavailable'
  | 'product_not_found'
  | 'user_cancelled'
  | 'already_owned'
  | 'pending'
  | 'network'
  | 'validation_failed'
  | 'conflict'
  | 'unknown';

export interface IapErrorShape {
  code: IapErrorCode;
  message: string;
  cause?: unknown;
}

export class IapError extends Error {
  readonly code: IapErrorCode;
  readonly cause?: unknown;

  constructor(shape: IapErrorShape) {
    super(shape.message);
    this.name = 'IapError';
    this.code = shape.code;
    this.cause = shape.cause;
  }
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
npx jest src/iap/__tests__/errors.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/iap/errors.ts src/iap/__tests__/errors.test.ts
git commit -m "feat(iap): IapError class with typed codes"
```

---

### Task 3: Event bus

**Files:**
- Create: `src/iap/events.ts`
- Test: `src/iap/__tests__/events.test.ts`

- [ ] **Step 1: Write the failing test**

`src/iap/__tests__/events.test.ts`:
```typescript
import { iapEvents } from '../events';

describe('iapEvents', () => {
  it('delivers events to subscribers', () => {
    const heard: any[] = [];
    const off = iapEvents.on('purchase.success', (p) => heard.push(p));
    iapEvents.emit('purchase.success', { tierId: 'pro_monthly' });
    expect(heard).toEqual([{ tierId: 'pro_monthly' }]);
    off();
  });

  it('unsubscribes correctly', () => {
    const heard: any[] = [];
    const off = iapEvents.on('purchase.success', (p) => heard.push(p));
    off();
    iapEvents.emit('purchase.success', { tierId: 'x' });
    expect(heard).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npx jest src/iap/__tests__/events.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement event bus**

`src/iap/events.ts`:
```typescript
export type IapEventMap = {
  'purchase.started': { tierId: string };
  'purchase.success': { tierId: string };
  'purchase.failed': { tierId: string; code: string; message: string };
  'purchase.cancelled': { tierId: string };
  'subscription.changed': { source: string | null };
};

type Listener<K extends keyof IapEventMap> = (payload: IapEventMap[K]) => void;

class IapEventBus {
  private listeners: { [K in keyof IapEventMap]?: Set<Listener<K>> } = {};

  on<K extends keyof IapEventMap>(event: K, fn: Listener<K>): () => void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    (this.listeners[event] as Set<Listener<K>>).add(fn);
    return () => {
      (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(fn);
    };
  }

  emit<K extends keyof IapEventMap>(event: K, payload: IapEventMap[K]): void {
    this.listeners[event]?.forEach((fn) => {
      try {
        (fn as Listener<K>)(payload);
      } catch (e) {
        console.warn('[iapEvents] listener threw:', e);
      }
    });
  }
}

export const iapEvents = new IapEventBus();
```

- [ ] **Step 4: Run, verify PASS**

```bash
npx jest src/iap/__tests__/events.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/iap/events.ts src/iap/__tests__/events.test.ts
git commit -m "feat(iap): typed event bus for purchase lifecycle"
```

---

### Task 4: Pending receipt store

**Files:**
- Create: `src/iap/pendingReceiptStore.ts`
- Test: `src/iap/__tests__/pendingReceiptStore.test.ts`

This persists receipts we've received from the store but not yet successfully verified with the backend. We retry from this queue on app open and on network reachable.

- [ ] **Step 1: Write the failing test**

`src/iap/__tests__/pendingReceiptStore.test.ts`:
```typescript
import * as SecureStore from 'expo-secure-store';
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
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npx jest src/iap/__tests__/pendingReceiptStore.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/iap/pendingReceiptStore.ts`:
```typescript
import * as SecureStore from 'expo-secure-store';

const KEY = 'iap.pendingReceipts.v1';

export interface PendingReceipt {
  platform: 'ios' | 'android';
  productId: string;
  transactionId: string;
  originalTransactionId?: string;
  receipt: string;
  purchaseToken?: string; // Android only
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
    if (list.some((r) => r.platform === receipt.platform && r.transactionId === receipt.transactionId)) {
      return;
    }
    list.push(receipt);
    await writeAll(list);
  },

  async remove(platform: PendingReceipt['platform'], transactionId: string): Promise<void> {
    const list = await readAll();
    const next = list.filter((r) => !(r.platform === platform && r.transactionId === transactionId));
    if (next.length !== list.length) await writeAll(next);
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
  },
};
```

- [ ] **Step 4: Verify SecureStore mock in jest.setup.js**

Run:
```bash
grep -A 3 "expo-secure-store" /home/garan/Documents/programming/live-projects/wrapbattz2/app/wrapbattz/jest.setup.js
```

Expected: existing mock for `getItemAsync` / `setItemAsync` / `deleteItemAsync`. If the mock is naive (just `jest.fn()`), the test relies on in-memory implementation. If tests fail with mock-related errors, replace those mocks with an in-memory store. Patch in `jest.setup.js`:
```javascript
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn((k) => Promise.resolve(store.get(k) ?? null)),
    setItemAsync: jest.fn((k, v) => { store.set(k, v); return Promise.resolve(); }),
    deleteItemAsync: jest.fn((k) => { store.delete(k); return Promise.resolve(); }),
  };
});
```

- [ ] **Step 5: Run, verify PASS**

```bash
npx jest src/iap/__tests__/pendingReceiptStore.test.ts
```
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/iap/pendingReceiptStore.ts src/iap/__tests__/pendingReceiptStore.test.ts jest.setup.js
git commit -m "feat(iap): persistent pending-receipt queue"
```

---

### Task 5: `IapService` wrapper over `react-native-iap`

**Files:**
- Create: `src/iap/IapService.ts`
- Test: `src/iap/__tests__/IapService.test.ts`

- [ ] **Step 1: Mock `react-native-iap` in `jest.setup.js`**

In `jest.setup.js` (append a single block — collapse any existing iap mock if present):
```javascript
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(() => Promise.resolve(true)),
  endConnection: jest.fn(() => Promise.resolve(true)),
  getSubscriptions: jest.fn(() => Promise.resolve([])),
  requestSubscription: jest.fn(() => Promise.resolve(null)),
  finishTransaction: jest.fn(() => Promise.resolve()),
  getAvailablePurchases: jest.fn(() => Promise.resolve([])),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  flushFailedPurchasesCachedAsPendingAndroid: jest.fn(() => Promise.resolve()),
  acknowledgePurchaseAndroid: jest.fn(() => Promise.resolve()),
}));
```

- [ ] **Step 2: Write the failing test**

`src/iap/__tests__/IapService.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run, verify FAIL**

```bash
npx jest src/iap/__tests__/IapService.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `IapService`**

`src/iap/IapService.ts`:
```typescript
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
```

- [ ] **Step 5: Run, verify PASS**

```bash
npx jest src/iap/__tests__/IapService.test.ts
```
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/iap/IapService.ts src/iap/__tests__/IapService.test.ts jest.setup.js
git commit -m "feat(iap): IapService wrapper over react-native-iap"
```

---

## Phase 2 — Backend API client

### Task 6: Billing types

**Files:**
- Create: `src/api/types-billing.ts`

These types are not in the OpenAPI schema yet (backend ships them later). Keep them in a separate file from `src/api/types.ts` so regenerating the schema doesn't clobber them.

- [ ] **Step 1: Create types file**

`src/api/types-billing.ts`:
```typescript
export type SubscriptionSource = 'stripe' | 'apple_iap' | 'google_iap';
export type SubscriptionStatus =
  | 'active'
  | 'in_grace_period'
  | 'expired'
  | 'cancelled'
  | 'refunded'
  | 'pending';

export interface TierCatalogItem {
  tier_id: string;
  name: string;
  description: string;
  features: string[];
  asset_cap: number | null;
  duration: 'monthly' | 'annual';
  ios_product_id: string | null;
  android_product_id: string | null;
  stripe_price_id: string | null;
  sort_order: number;
}

export interface CatalogResponse {
  items: TierCatalogItem[];
}

export interface SubscriptionState {
  source: SubscriptionSource | null;
  tier_id: string | null;
  status: SubscriptionStatus | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  purchasing_user_id: number | null;
  managed_in: 'app_store' | 'play_store' | 'stripe_portal' | null;
}

export interface IapVerifyRequest {
  platform: 'ios' | 'android';
  product_id: string;
  transaction_id: string;
  original_transaction_id?: string;
  receipt: string;
  purchase_token?: string;
}

export interface IapRestoreReceipt {
  transaction_id: string;
  receipt: string;
  product_id: string;
}

export interface IapRestoreRequest {
  platform: 'ios' | 'android';
  receipts: IapRestoreReceipt[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/types-billing.ts
git commit -m "feat(api): billing types for catalog, subscription, IAP verify/restore"
```

---

### Task 7: Billing endpoints

**Files:**
- Create: `src/api/endpoints/billing.ts`
- Modify: `src/api/endpoints/index.ts`
- Test: `src/api/endpoints/__tests__/billing.test.ts`

Mirror the existing pattern in `members.ts`.

- [ ] **Step 1: Write the failing test**

`src/api/endpoints/__tests__/billing.test.ts`:
```typescript
import { apiClient } from '../../client';
import * as billing from '../billing';

jest.mock('../../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('billing endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /billing/catalog', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: { items: [{ tier_id: 'pro' }] },
    });
    const res = await billing.getCatalog();
    expect(apiClient.get).toHaveBeenCalledWith('/billing/catalog');
    expect(res.items[0].tier_id).toBe('pro');
  });

  it('GET /billing/subscription', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: { source: 'apple_iap', status: 'active' },
    });
    const res = await billing.getSubscription();
    expect(apiClient.get).toHaveBeenCalledWith('/billing/subscription');
    expect(res.status).toBe('active');
  });

  it('POST /billing/iap/verify', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { source: 'apple_iap' } });
    const res = await billing.iapVerify({
      platform: 'ios',
      product_id: 'p',
      transaction_id: 't',
      receipt: 'r',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/billing/iap/verify', {
      platform: 'ios',
      product_id: 'p',
      transaction_id: 't',
      receipt: 'r',
    });
    expect(res.source).toBe('apple_iap');
  });

  it('POST /billing/iap/restore', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { source: null } });
    await billing.iapRestore({ platform: 'ios', receipts: [] });
    expect(apiClient.post).toHaveBeenCalledWith('/billing/iap/restore', {
      platform: 'ios',
      receipts: [],
    });
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npx jest src/api/endpoints/__tests__/billing.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/api/endpoints/billing.ts`:
```typescript
import { apiClient } from '../client';
import type {
  CatalogResponse,
  IapRestoreRequest,
  IapVerifyRequest,
  SubscriptionState,
} from '../types-billing';

export async function getCatalog(): Promise<CatalogResponse> {
  const { data } = await apiClient.get<CatalogResponse>('/billing/catalog');
  return data;
}

export async function getSubscription(): Promise<SubscriptionState> {
  const { data } = await apiClient.get<SubscriptionState>('/billing/subscription');
  return data;
}

export async function iapVerify(payload: IapVerifyRequest): Promise<SubscriptionState> {
  const { data } = await apiClient.post<SubscriptionState>('/billing/iap/verify', payload);
  return data;
}

export async function iapRestore(payload: IapRestoreRequest): Promise<SubscriptionState> {
  const { data } = await apiClient.post<SubscriptionState>('/billing/iap/restore', payload);
  return data;
}
```

- [ ] **Step 4: Register in `src/api/endpoints/index.ts`**

Append:
```typescript
export * as billing from './billing';
```

- [ ] **Step 5: Run, verify PASS**

```bash
npx jest src/api/endpoints/__tests__/billing.test.ts
```
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/api/endpoints/billing.ts src/api/endpoints/index.ts src/api/endpoints/__tests__/billing.test.ts
git commit -m "feat(api): billing endpoints (catalog, subscription, iap verify/restore)"
```

---

## Phase 3 — Receipt upload + product catalog

### Task 8: `receiptUploader` with retry queue

**Files:**
- Create: `src/iap/receiptUploader.ts`
- Test: `src/iap/__tests__/receiptUploader.test.ts`

- [ ] **Step 1: Write the failing test**

`src/iap/__tests__/receiptUploader.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npx jest src/iap/__tests__/receiptUploader.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/iap/receiptUploader.ts`:
```typescript
import { iapVerify } from '../api/endpoints/billing';
import { ApiError } from '../api/errors';
import type { SubscriptionState } from '../api/types-billing';
import { pendingReceiptStore, PendingReceipt } from './pendingReceiptStore';
import { IapError } from './errors';

/**
 * Codes that mean "this receipt is permanently unprocessable; stop retrying."
 * Other errors (network, server) leave the receipt in the queue for later flush.
 */
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
      // permanent errors already removed by uploadReceipt; transient ones stay
      // queued and will be retried on the next flush.
      console.warn('[receiptUploader] flush retry skipped:', e);
    }
  }
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
npx jest src/iap/__tests__/receiptUploader.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/iap/receiptUploader.ts src/iap/__tests__/receiptUploader.test.ts
git commit -m "feat(iap): receiptUploader with permanent-vs-transient error handling"
```

---

### Task 9: Product catalog with platform-id resolution

**Files:**
- Create: `src/iap/productCatalog.ts`
- Test: `src/iap/__tests__/productCatalog.test.ts`

- [ ] **Step 1: Write the failing test**

`src/iap/__tests__/productCatalog.test.ts`:
```typescript
import { Platform } from 'react-native';
import * as billingApi from '../../api/endpoints/billing';
import { fetchCatalog, productIdsForPlatform } from '../productCatalog';
import type { TierCatalogItem } from '../../api/types-billing';

jest.mock('../../api/endpoints/billing');

const items: TierCatalogItem[] = [
  {
    tier_id: 'pro_monthly',
    name: 'Pro',
    description: '',
    features: [],
    asset_cap: 50,
    duration: 'monthly',
    ios_product_id: 'com.tooltraq.sub.pro.monthly',
    android_product_id: 'tooltraq_sub_pro_monthly',
    stripe_price_id: null,
    sort_order: 10,
  },
  {
    tier_id: 'business_monthly',
    name: 'Business',
    description: '',
    features: [],
    asset_cap: 250,
    duration: 'monthly',
    ios_product_id: null, // not yet shipped on iOS
    android_product_id: 'tooltraq_sub_business_monthly',
    stripe_price_id: null,
    sort_order: 20,
  },
];

describe('productCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (billingApi.getCatalog as jest.Mock).mockResolvedValue({ items });
  });

  it('fetches catalog from backend', async () => {
    const res = await fetchCatalog();
    expect(res.items.length).toBe(2);
  });

  it('extracts iOS product IDs, skipping tiers without an iOS id', () => {
    (Platform as any).OS = 'ios';
    expect(productIdsForPlatform(items)).toEqual(['com.tooltraq.sub.pro.monthly']);
  });

  it('extracts Android product IDs', () => {
    (Platform as any).OS = 'android';
    expect(productIdsForPlatform(items)).toEqual([
      'tooltraq_sub_pro_monthly',
      'tooltraq_sub_business_monthly',
    ]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npx jest src/iap/__tests__/productCatalog.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/iap/productCatalog.ts`:
```typescript
import { Platform } from 'react-native';
import { getCatalog } from '../api/endpoints/billing';
import type { CatalogResponse, TierCatalogItem } from '../api/types-billing';

export async function fetchCatalog(): Promise<CatalogResponse> {
  return getCatalog();
}

export function productIdsForPlatform(items: TierCatalogItem[]): string[] {
  const key = Platform.OS === 'ios' ? 'ios_product_id' : 'android_product_id';
  return items
    .map((i) => i[key])
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function tierForProductId(
  items: TierCatalogItem[],
  productId: string,
): TierCatalogItem | undefined {
  const key = Platform.OS === 'ios' ? 'ios_product_id' : 'android_product_id';
  return items.find((i) => i[key] === productId);
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
npx jest src/iap/__tests__/productCatalog.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/iap/productCatalog.ts src/iap/__tests__/productCatalog.test.ts
git commit -m "feat(iap): productCatalog with platform-id resolution"
```

---

### Task 10: Public surface re-exports

**Files:**
- Create: `src/iap/index.ts`

- [ ] **Step 1: Write index**

`src/iap/index.ts`:
```typescript
export { iapService } from './IapService';
export type { IapProduct, IapPurchase } from './IapService';
export { IapError } from './errors';
export type { IapErrorCode } from './errors';
export { iapEvents } from './events';
export type { IapEventMap } from './events';
export { pendingReceiptStore } from './pendingReceiptStore';
export type { PendingReceipt } from './pendingReceiptStore';
export { uploadReceipt, flushPendingReceipts } from './receiptUploader';
export { fetchCatalog, productIdsForPlatform, tierForProductId } from './productCatalog';
```

- [ ] **Step 2: Commit**

```bash
git add src/iap/index.ts
git commit -m "feat(iap): public module surface"
```

---

## Phase 4 — Hooks

### Task 11: `useSubscription` hook

**Files:**
- Create: `src/screens/Subscribe/hooks/useSubscription.ts`
- Test: `src/screens/Subscribe/hooks/__tests__/useSubscription.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/screens/Subscribe/hooks/__tests__/useSubscription.test.tsx`:
```typescript
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as billingApi from '../../../../api/endpoints/billing';
import { useSubscription } from '../useSubscription';

jest.mock('../../../../api/endpoints/billing');

function Probe() {
  const { state, isLoading, error } = useSubscription();
  return <Text testID="probe">{`${isLoading ? 'loading' : 'ready'}|${state?.status ?? 'none'}|${error ?? ''}`}</Text>;
}

describe('useSubscription', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports loading then ready', async () => {
    (billingApi.getSubscription as jest.Mock).mockResolvedValueOnce({
      source: 'apple_iap',
      status: 'active',
    });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('probe').props.children).toContain('loading');
    await waitFor(() =>
      expect(getByTestId('probe').props.children).toContain('ready|active|'),
    );
  });

  it('reports error message on failure', async () => {
    (billingApi.getSubscription as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { getByTestId } = render(<Probe />);
    await waitFor(() =>
      expect(getByTestId('probe').props.children).toContain('boom'),
    );
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npx jest src/screens/Subscribe/hooks/__tests__/useSubscription.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/screens/Subscribe/hooks/useSubscription.ts`:
```typescript
import { useCallback, useEffect, useState } from 'react';
import { getSubscription } from '../../../api/endpoints/billing';
import { ApiError } from '../../../api/errors';
import type { SubscriptionState } from '../../../api/types-billing';
import { iapEvents } from '../../../iap';

export interface UseSubscriptionResult {
  state: SubscriptionState | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await getSubscription();
      setState(next);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') return;
      setError(e instanceof Error ? e.message : 'Failed to load subscription.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when something downstream signals a change.
  useEffect(() => {
    const off = iapEvents.on('subscription.changed', () => {
      refresh();
    });
    return off;
  }, [refresh]);

  return { state, isLoading, error, refresh };
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
npx jest src/screens/Subscribe/hooks/__tests__/useSubscription.test.tsx
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Subscribe/hooks/useSubscription.ts src/screens/Subscribe/hooks/__tests__/useSubscription.test.tsx
git commit -m "feat(subscribe): useSubscription hook reads /billing/subscription"
```

---

### Task 12: `usePurchaseFlow` orchestrator

**Files:**
- Create: `src/screens/Subscribe/hooks/usePurchaseFlow.ts`
- Test: `src/screens/Subscribe/hooks/__tests__/usePurchaseFlow.test.tsx`

This wires the store-side purchase flow to the backend verify call. On a successful store purchase, we enqueue the receipt to `pendingReceiptStore`, attempt an immediate upload, and only call `finishTransaction` after the backend confirms. If verify fails transiently, the receipt stays in the queue for `flushPendingReceipts` to retry later.

- [ ] **Step 1: Write the failing test**

`src/screens/Subscribe/hooks/__tests__/usePurchaseFlow.test.tsx`:
```typescript
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';
import { iapService } from '../../../../iap';
import * as billingApi from '../../../../api/endpoints/billing';
import { usePurchaseFlow } from '../usePurchaseFlow';

jest.mock('../../../../api/endpoints/billing');

function Probe({ onMount }: { onMount?: (api: ReturnType<typeof usePurchaseFlow>) => void }) {
  const flow = usePurchaseFlow();
  React.useEffect(() => onMount?.(flow), []);
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
    // store will deliver a purchase via the subscription callback once
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
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npx jest src/screens/Subscribe/hooks/__tests__/usePurchaseFlow.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/screens/Subscribe/hooks/usePurchaseFlow.ts`:
```typescript
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
        // Some platforms (Android) can deliver a PENDING purchase that we
        // shouldn't finishTransaction on. The receipt is empty in that case.
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
          iapEvents.emit('subscription.changed', { source: p.platform === 'ios' ? 'apple_iap' : 'google_iap' });
        } catch (e: any) {
          // Permanent errors are stripped from the queue inside uploadReceipt;
          // transient ones stay and will be flushed later. Either way the user
          // gets a non-success state.
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
```

- [ ] **Step 4: Run, verify PASS**

```bash
npx jest src/screens/Subscribe/hooks/__tests__/usePurchaseFlow.test.tsx
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Subscribe/hooks/usePurchaseFlow.ts src/screens/Subscribe/hooks/__tests__/usePurchaseFlow.test.tsx
git commit -m "feat(subscribe): usePurchaseFlow orchestrator with safe-finish semantics"
```

---

## Phase 5 — UI

### Task 13: `SubscribeScreen`

**Files:**
- Create: `src/screens/Subscribe/SubscribeScreen.tsx`

This is the main user-facing surface. UI test coverage is left to manual QA per CLAUDE.md (UI verification == use it in a browser/device, not unit tests). The hooks above are already unit-tested.

- [ ] **Step 1: Implement the screen**

`src/screens/Subscribe/SubscribeScreen.tsx`:
```typescript
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import {
  iapService,
  fetchCatalog,
  productIdsForPlatform,
  tierForProductId,
  type IapProduct,
} from '../../iap';
import { iapRestore } from '../../api/endpoints/billing';
import { useSubscription } from './hooks/useSubscription';
import { usePurchaseFlow } from './hooks/usePurchaseFlow';
import type { TierCatalogItem } from '../../api/types-billing';

const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
const GOOGLE_MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

const SubscribeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const sub = useSubscription();
  const flow = usePurchaseFlow();

  const [tiers, setTiers] = useState<TierCatalogItem[]>([]);
  const [products, setProducts] = useState<IapProduct[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    setLoadingCatalog(true);
    try {
      await iapService.init();
      const cat = await fetchCatalog();
      const ids = productIdsForPlatform(cat.items);
      const prods = await iapService.getProducts(ids);
      setTiers(cat.items);
      setProducts(prods);
    } catch (e: any) {
      setCatalogError(e?.message ?? 'Could not load plans.');
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // If the purchase flow completed, refresh subscription state.
  useEffect(() => {
    if (flow.status === 'active') sub.refresh();
  }, [flow.status, sub]);

  const productById = useMemo(() => {
    const m = new Map<string, IapProduct>();
    products.forEach((p) => m.set(p.productId, p));
    return m;
  }, [products]);

  const handleSubscribe = (tier: TierCatalogItem) => {
    const productId =
      Platform.OS === 'ios' ? tier.ios_product_id : tier.android_product_id;
    if (!productId) {
      Alert.alert('Unavailable', 'This plan is not available on your platform.');
      return;
    }
    flow.purchase(productId);
  };

  const handleManage = () => {
    Linking.openURL(Platform.OS === 'ios' ? APPLE_MANAGE_URL : GOOGLE_MANAGE_URL);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const purchases = await iapService.getAvailablePurchases();
      if (purchases.length === 0) {
        Alert.alert('No purchases found', 'There are no subscriptions tied to this account on this device.');
        return;
      }
      const restored = await iapRestore({
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        receipts: purchases.map((p) => ({
          transaction_id: p.transactionId,
          receipt: p.transactionReceipt,
          product_id: p.productId,
        })),
      });
      await sub.refresh();
      if (restored.status === 'active') {
        Alert.alert('Restored', 'Your subscription has been restored.');
      } else {
        Alert.alert(
          'Nothing to restore',
          'No active subscription was found for this organization.',
        );
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const renderTier = (tier: TierCatalogItem) => {
    const productId =
      Platform.OS === 'ios' ? tier.ios_product_id : tier.android_product_id;
    const product = productId ? productById.get(productId) : undefined;
    const isCurrent = sub.state?.tier_id === tier.tier_id;
    const busy = flow.status === 'purchasing' || flow.status === 'verifying';
    return (
      <View
        key={tier.tier_id}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.tierName, { color: colors.textPrimary }]}>{tier.name}</Text>
        <Text style={[styles.tierPrice, { color: colors.primary }]}>
          {product?.localizedPrice ?? '—'}
          <Text style={[styles.tierPeriod, { color: colors.textSecondary }]}>
            {' / '}{tier.duration === 'annual' ? 'year' : 'month'}
          </Text>
        </Text>
        <Text style={[styles.tierDesc, { color: colors.textSecondary }]}>{tier.description}</Text>
        <View style={styles.featureList}>
          {tier.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.textPrimary }]}>{f}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          disabled={isCurrent || busy || !product}
          style={[
            styles.cta,
            { backgroundColor: isCurrent ? colors.disabled : colors.primary },
          ]}
          onPress={() => handleSubscribe(tier)}
          accessibilityRole="button"
          accessibilityLabel={isCurrent ? `Current plan ${tier.name}` : `Subscribe to ${tier.name}`}
        >
          {busy ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.ctaText}>
              {isCurrent ? 'Current plan' : !product ? 'Unavailable' : 'Subscribe'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Subscription</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Current state */}
        <View style={[styles.stateCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          {sub.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : sub.state?.source ? (
            <>
              <Text style={[styles.stateLabel, { color: colors.textSecondary }]}>Current plan</Text>
              <Text style={[styles.stateValue, { color: colors.textPrimary }]}>
                {sub.state.tier_id ?? 'Active'}
                {sub.state.status !== 'active' ? ` (${sub.state.status})` : ''}
              </Text>
              <Text style={[styles.stateMeta, { color: colors.textMuted }]}>
                Managed in {sub.state.managed_in === 'app_store' ? 'the App Store' : sub.state.managed_in === 'play_store' ? 'Google Play' : 'the web portal'}
              </Text>
              {(sub.state.source === 'apple_iap' || sub.state.source === 'google_iap') ? (
                <TouchableOpacity style={[styles.manageBtn, { borderColor: colors.border }]} onPress={handleManage}>
                  <Text style={[styles.manageText, { color: colors.primary }]}>Manage subscription</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <Text style={[styles.stateValue, { color: colors.textPrimary }]}>No active subscription</Text>
          )}
        </View>

        {/* Tier list */}
        {loadingCatalog ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : catalogError ? (
          <View style={styles.center}>
            <Text style={[styles.error, { color: colors.textPrimary }]}>{catalogError}</Text>
            <TouchableOpacity onPress={loadCatalog} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tiers.map(renderTier)
        )}

        {flow.status === 'error' && flow.errorMessage ? (
          <Text style={[styles.flowError, { color: '#F85149' }]}>{flow.errorMessage}</Text>
        ) : null}
        {flow.status === 'pending' ? (
          <Text style={[styles.flowError, { color: colors.textSecondary }]}>
            Purchase is pending — we'll confirm when it clears.
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handleRestore}
          disabled={restoring}
          style={[styles.restoreBtn]}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
        >
          {restoring ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.restoreText, { color: colors.primary }]}>Restore purchases</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: '#000', fontWeight: '600' },
  stateCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 18,
  },
  stateLabel: { fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  stateValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  stateMeta: { fontSize: 12, marginTop: 4 },
  manageBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  manageText: { fontSize: 14, fontWeight: '600' },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 14,
  },
  tierName: { fontSize: 18, fontWeight: '700' },
  tierPrice: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  tierPeriod: { fontSize: 14, fontWeight: '500' },
  tierDesc: { fontSize: 13, marginTop: 4, marginBottom: 12 },
  featureList: { marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  featureText: { fontSize: 14 },
  cta: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaText: { color: '#000', fontWeight: '700', fontSize: 15 },
  flowError: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  restoreBtn: { marginTop: 18, padding: 12, alignItems: 'center' },
  restoreText: { fontSize: 14, fontWeight: '600' },
});

export default SubscribeScreen;
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/Subscribe/SubscribeScreen.tsx
git commit -m "feat(subscribe): SubscribeScreen with tier list, purchase, restore, manage"
```

---

## Phase 6 — Integration

### Task 14: Register `Subscribe` route + Settings link

**Files:**
- Modify: `src/navigation/index.tsx`
- Modify: `src/screens/Settings/sections.ts`

- [ ] **Step 1: Add import to `src/navigation/index.tsx`**

Near the existing screen imports, add:
```typescript
import SubscribeScreen from '../screens/Subscribe/SubscribeScreen';
```

- [ ] **Step 2: Register the screen**

In `MainStack` (above the `Members` registration is a sensible spot), add:
```tsx
<Stack.Screen
  name="Subscribe"
  component={SubscribeScreen}
  options={{ headerShown: false }}
/>
```

- [ ] **Step 3: Add Settings row in `src/screens/Settings/sections.ts`**

Inside the `billing` section, add as the first row:
```typescript
{ key: 'subscription', label: 'Subscription', icon: 'card-outline', kind: 'nav', destination: 'Subscribe' },
```

- [ ] **Step 4: Run settings test to verify wiring**

```bash
npx jest src/screens/Settings/__tests__/sections.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/index.tsx src/screens/Settings/sections.ts
git commit -m "feat(subscribe): register Subscribe route and Settings link"
```

---

### Task 15: Branch `ManageBillingScreen` on subscription source

**Files:**
- Modify: `src/screens/PaymentScreens/ManageBillingScreen.js`

This screen exists today as the Stripe-driven manage UI. For orgs paying via IAP, redirect users to the native subscription management page instead of rendering Stripe controls.

- [ ] **Step 1: Read the current top of the file**

Run:
```bash
sed -n '1,80p' src/screens/PaymentScreens/ManageBillingScreen.js
```
Expected: a screen that fetches the current subscription via `BillingService` and renders Stripe controls.

- [ ] **Step 2: Add early branch on source**

Inside the component body, after subscription state has loaded and before the Stripe-driven render, insert:

```javascript
import { Linking, Platform } from 'react-native';

// ... inside component, after current sub is known:
const iapSourced = currentSubscription?.source === 'apple_iap' || currentSubscription?.source === 'google_iap';
if (iapSourced) {
  const url = currentSubscription.source === 'apple_iap'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Manage Billing</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={{ padding: 24, gap: 12 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
          Managed via {currentSubscription.source === 'apple_iap' ? 'the App Store' : 'Google Play'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          Your subscription was purchased on this platform. To change plan, update payment, or cancel,
          please use the platform's own subscription management.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 }}
          onPress={() => Linking.openURL(url)}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>
            Open {currentSubscription.source === 'apple_iap' ? 'App Store' : 'Google Play'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
```

(If the existing file doesn't already import `Linking`, add it. If it doesn't already destructure `currentSubscription` from somewhere, add a `billingService.getCurrentSubscription()` call alongside the existing fetch, or read from a context if one exists. Match what the file is already doing — don't restructure beyond what's needed.)

- [ ] **Step 3: Manually verify the screen still renders on Stripe accounts**

Read the file end-to-end and confirm the new branch only triggers when source is `apple_iap` or `google_iap`. Stripe accounts and accounts with no sub at all must fall through to the existing render.

- [ ] **Step 4: Commit**

```bash
git add src/screens/PaymentScreens/ManageBillingScreen.js
git commit -m "feat(billing): route IAP-sourced subs to native management UI"
```

---

### Task 16: Initialize IAP at app start, flush queue on app focus

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Inspect `App.tsx`**

Run:
```bash
sed -n '1,40p' /home/garan/Documents/programming/live-projects/wrapbattz2/app/wrapbattz/App.tsx 2>/dev/null || sed -n '1,40p' /home/garan/Documents/programming/live-projects/wrapbattz2/app/wrapbattz/App.js
```
Expected: a root component wrapping providers + `<AppNavigator />`.

- [ ] **Step 2: Add IAP init and queue flush**

Add to the root component (inside an `useEffect`):

```typescript
import { AppState } from 'react-native';
import { iapService, flushPendingReceipts } from './src/iap';

// inside App component
useEffect(() => {
  iapService.init().catch((e) => console.warn('[iap] init failed:', e));
  flushPendingReceipts().catch((e) => console.warn('[iap] initial flush failed:', e));
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'active') flushPendingReceipts().catch(() => {});
  });
  return () => {
    sub.remove();
    iapService.teardown().catch(() => {});
  };
}, []);
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p . 2>&1 | grep -v "\.worktrees" | grep -v "TS5098" | head -20
```
Expected: no errors.

- [ ] **Step 4: Run the unit test suite**

```bash
npx jest --silent --testPathIgnorePatterns="\.worktrees" 2>&1 | tail -10
```
Expected: pre-existing failures unchanged; new IAP tests all pass.

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "feat(iap): initialize service at app start and flush queue on focus"
```

---

## Phase 7 — Manual QA + final wiring

### Task 17: Manual test plan

This task is procedural — it produces no code, but documents what to test on real hardware so QA has a concrete checklist when sandbox IAP products are configured.

- [ ] **Step 1: Append a QA section to the spec doc**

Open `docs/superpowers/specs/2026-05-12-iap-subscriptions-design.md` and append:

```markdown
## QA checklist (mobile)

Requires: sandbox Apple ID + Play Console license test account, backend
endpoints stubbed or live, at least one tier configured in App Store
Connect AND Play Console with a sandbox-tier price.

### Happy path
- [ ] Sign in as an org owner with no active sub. Open Settings → Subscription. See tier list with prices from the store (not the backend).
- [ ] Tap Subscribe on a tier. Native sheet appears. Confirm. App shows "verifying" then "active". Settings shows new plan. Backend `/billing/subscription` returns the new state.

### Restore
- [ ] Uninstall and reinstall the app. Sign in. Open Subscription. Tap "Restore purchases". App shows "Restored" toast. State is correct.

### Cancel
- [ ] On an active IAP-sourced sub, tap "Manage subscription". Native subscription management opens. Cancel from there. Reopen app. State updates (via webhook → backend → mobile refresh on focus).

### Already-subscribed conflict
- [ ] On an org that already has Stripe sub, attempt to subscribe via IAP. Backend returns 409. App shows the conflict message and refunds automatically via Apple/Google (no `finishTransaction` called).

### Network failure
- [ ] Disable network mid-purchase. Confirm purchase in native sheet. App shows error, but on re-enabling network the queued receipt is processed on next app focus.

### Android pending
- [ ] Use a cash payment in Play sandbox. App shows "pending". Later webhook delivers, state becomes "active" on next refresh.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-12-iap-subscriptions-design.md
git commit -m "docs(iap): manual QA checklist for sandbox testing"
```

---

## Self-review notes (built into the plan)

- **Spec coverage:** Tasks 1–16 cover catalog fetch, subscription read, purchase flow, restore, finish-on-confirm semantics, pending queue, error taxonomy, navigation/settings wiring, ManageBilling branching, app-level init, manual QA. Backend contract specified in the spec is referenced but not implemented here — that's a separate plan.
- **Type consistency:** `PendingReceipt` fields, `SubscriptionState` fields, `IapPurchase` mapping, and `IapVerifyRequest` payload all agree across modules. `IapErrorCode` matches the codes thrown from `IapService` and `receiptUploader`.
- **Frequent commits:** every task ends with an explicit commit step. No "batch at end" — each piece lands independently.
- **TDD:** every module with non-trivial logic has a failing-test-first step. UI (SubscribeScreen, ManageBilling branch) is verified manually per CLAUDE.md.
- **No placeholders:** every code block is complete and runnable. No "implement appropriate error handling" — error handling is shown in line.
