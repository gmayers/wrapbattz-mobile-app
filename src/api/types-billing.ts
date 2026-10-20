export interface LimitBlock {
  included: number;
  addon: number;
  /** null when the plan is unlimited (included = 0 on the server). */
  limit: number | null;
  /** Seats: includes pending invitations (see `pending`). */
  used: number;
  remaining: number | null;
  unlimited?: boolean;
  /** Seats only: unexpired invitations holding a seat. */
  pending?: number;
}

export interface BillingState {
  tier: string | null;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: 'monthly' | 'annual' | null;
  in_grace_period: boolean;
  grace_ends_at: string | null;
  limits: { seats: LimitBlock; devices: LimitBlock };
  credits: {
    balance: number;
    next_expiry: string | null;
    // BattWrapz shop wallet. wallet_balance_pence is null when the shop
    // couldn't be reached (show "unavailable", not £0) or for non-admins.
    wallet_enabled?: boolean;
    wallet_balance_pence?: number | null;
    store_url?: string | null;
  };
  features: Record<string, boolean>;
  stripe_customer_id: string | null;
  actions: {
    can_upgrade: boolean;
    can_buy_seats: boolean;
    can_buy_devices: boolean;
    can_open_portal: boolean;
    needs_payment_method: boolean;
  };
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

export interface CustomerSheetSession {
  customer_id: string;
  ephemeral_key_secret: string;
  setup_intent_client_secret: string;
}

/** GET /billing/credits/ — the org's credit to spend at the BattWrapz shop. */
export interface StoreCreditRow {
  date: string;
  kind: 'added' | 'expired' | 'adjusted';
  credits: number;
  amount_pence: number;
  amount_display: string;
  expires_at: string | null;
  // Not in the shop yet (queued, or being retried).
  pending: boolean;
}

export interface StoreCredit {
  wallet_enabled: boolean;
  // null when the shop couldn't be reached.
  balance_pence: number | null;
  balance_display: string | null;
  next_expiry: string | null;
  store_url: string | null;
  // The credit sits in the owner's shop account; false for anyone else.
  held_by_you: boolean;
  holder_name: string;
  history: StoreCreditRow[];
}

/** POST /billing/credits/store-link/ — single-use, expires in two minutes. */
export interface StoreLink {
  url: string;
  // false when the link only opens the shop (they sign in there).
  signs_in: boolean;
}
