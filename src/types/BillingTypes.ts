// Billing Type Definitions
export interface Subscription {
  id: string;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid' | 'incomplete';
  plan_slug: string;
  plan_name: string;
  cycle: 'monthly' | 'annual';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  device_count: number;
  amount: number;
  currency: string;
  created: string;
  updated: string;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  features: string[];
  device_limit?: number;
  is_popular?: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    funding: string;
  };
  billing_details: {
    name?: string;
    email?: string;
    address?: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
  };
  is_default: boolean;
  created: string;
}

export interface Invoice {
  id: string;
  number: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  amount_paid: number;
  amount_due: number;
  currency: string;
  created: string;
  due_date?: string;
  period_start: string;
  period_end: string;
  description?: string;
  download_url?: string;
  hosted_invoice_url?: string;
  lines: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  currency: string;
  quantity: number;
  period_start: string;
  period_end: string;
}

export interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'canceled';
  created: string;
  description?: string;
  failure_reason?: string;
  payment_method: {
    type: string;
    card?: {
      brand: string;
      last4: string;
    };
  };
  receipt_url?: string;
  invoice_id?: string;
}

export interface UsageData {
  current_device_count: number;
  billable_devices: number;
  free_quota: number;
  current_cost: number;
  period_start: string;
  period_end: string;
  next_billing_date: string;
  subscription: Subscription;
}

export interface Analytics {
  device_usage_trends: DeviceUsageTrend[];
  monthly_costs: MonthlyCost[];
  cost_projections: CostProjection[];
  billing_summary: BillingSummary;
}

export interface DeviceUsageTrend {
  date: string;
  device_count: number;
  billable_count: number;
}

export interface MonthlyCost {
  month: string;
  amount: number;
  device_count: number;
}

export interface CostProjection {
  device_count: number;
  monthly_cost: number;
  annual_cost: number;
  savings_annual: number;
}

export interface BillingSummary {
  total_paid: number;
  current_period_cost: number;
  average_monthly_cost: number;
  device_count_average: number;
  subscription_start_date: string;
}

export interface NotificationPreferences {
  email_notifications: boolean;
  payment_success: boolean;
  payment_failure: boolean;
  invoice_created: boolean;
  subscription_changes: boolean;
  cost_threshold_enabled: boolean;
  cost_threshold_amount?: number;
  device_count_alerts: boolean;
  additional_emails: string[];
}

export interface BillingError {
  error: string;
  details?: Record<string, any>;
  code?: string;
}

export interface SetupIntentResponse {
  setup_intent_client_secret: string;
  customer_id: string;
  ephemeral_key_secret: string;
}

export interface CustomerPortalResponse {
  url: string;
}

export interface CostCalculatorParams {
  device_count: number;
  plan_type?: 'monthly' | 'annual';
}

export interface CostCalculatorResponse {
  monthly_cost: number;
  annual_cost: number;
  savings_annual: number;
  cost_per_device: number;
  free_devices: number;
  billable_devices: number;
}

// API Response wrappers
export interface BillingApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next?: string;
  previous?: string;
}

// Form data types
export interface SwitchPlanData {
  plan_slug: string;
  prorate?: boolean;
}

export interface CancelSubscriptionData {
  at_period_end?: boolean;
}

export interface UpdateDeviceCountData {
  device_count: number;
}

export interface SetDefaultPaymentMethodData {
  payment_method_id: string;
  customer_id: string;
}

export interface ConfirmPaymentMethodData {
  payment_method_id: string;
  set_as_default?: boolean;
}

export interface CreateSubscriptionData {
  plan_slug: string;
  payment_method_id: string;
  device_count?: number;
  organization_id?: string;
}

export interface ActivateFreeTierData {
  organization_id?: string;
}