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

// ── Billing state / Stripe surface ────────────────────────────────
// Mirrors api/routers/billing/{state,plans,invoices,checkout,portal,
// payment_methods,addons}.py on the backend. Distinct from the IAP
// types above: `SubscriptionState` is the mobile IAP view of a
// subscription, `BillingState` is the full org billing picture.

/** Raw OrganizationSubscription.Status, plus "none" when the org has no row. */
export type BillingStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'grace'
  | 'canceled'
  | 'incomplete'
  | 'none';

export type BillingInterval = 'monthly' | 'annual';

/** Seat/device allowance. `limit` is included + addon; `remaining` can be 0. */
export interface LimitBlock {
  included: number;
  addon: number;
  limit: number;
  used: number;
  remaining: number;
}

export interface CreditsBlock {
  balance: number;
  next_expiry: string | null;
}

/** What the current org is allowed to do — drives button enablement. */
export interface ActionsBlock {
  can_upgrade: boolean;
  can_buy_seats: boolean;
  can_buy_devices: boolean;
  can_open_portal: boolean;
  needs_payment_method: boolean;
}

export interface BillingState {
  tier: string | null;
  status: BillingStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: BillingInterval | null;
  in_grace_period: boolean;
  grace_ends_at: string | null;
  limits: { seats: LimitBlock; devices: LimitBlock };
  credits: CreditsBlock;
  features: Record<string, boolean>;
  stripe_customer_id: string | null;
  actions: ActionsBlock;
}

/** All money fields across this surface are integer minor units (pence). */
export interface Plan {
  slug: string;
  name: string;
  subhead: string;
  selling_points: string[];
  monthly_price: number | null;
  annual_price: number | null;
  currency: string;
  included_seats: number;
  included_devices: number;
  included_credits: number;
  features: Record<string, boolean>;
}

export interface Addon {
  unit_price_monthly: number;
  currency: string;
}

export interface PlansResponse {
  plans: Plan[];
  /** Keyed by addon kind — "seats" and "devices" today. */
  addons: Record<string, Addon>;
}

export interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  status: string;
  hosted_invoice_url: string | null;
  pdf_url: string | null;
  created_at: string;
}

export interface CheckoutRequest {
  plan_slug: string;
  interval: BillingInterval;
}

export interface CheckoutResponse {
  client_secret: string;
  publishable_key: string;
  customer_id: string;
  subscription_id: string;
  ephemeral_key: string | null;
  amount: number;
  currency: string;
}

export interface PortalResponse {
  url: string;
  expires_at: string | null;
}

export interface CustomerSheetResponse {
  customer_id: string;
  ephemeral_key_secret: string;
  setup_intent_client_secret: string;
}

export interface DefaultPaymentMethodRequest {
  payment_method_id: string;
}

/**
 * Add-on purchase result. The backend answers 402 (not an exception path we
 * want) with this same body when `needs_payment_method` is true, so callers
 * must read `ok` rather than rely on the HTTP status alone.
 */
export interface AddonResult {
  ok: boolean;
  subscription_item_id: string | null;
  granted: number;
  new_limit: number;
  prorated_charge: number | null;
  next_invoice_amount: number | null;
  needs_payment_method: boolean;
  client_secret: string | null;
}
