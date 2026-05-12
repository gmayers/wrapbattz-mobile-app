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
