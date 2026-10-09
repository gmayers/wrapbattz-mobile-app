export interface LimitBlock {
  included: number;
  addon: number;
  limit: number;
  used: number;
  remaining: number;
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
  credits: { balance: number; next_expiry: string | null };
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

// GET /billing/plans/ — public plan catalog. Prices are in pence; null
// means "contact us" (no list price).
export interface PlanSummary {
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

export interface PlansCatalog {
  plans: PlanSummary[];
  addons: Record<string, { unit_price_monthly: number; currency: string }>;
}
