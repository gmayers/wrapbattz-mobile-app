// BillingService now runs on the new /api/v1/ client. The new backend has not
// yet exposed /billing/* endpoints — these calls will fail with a clear
// ApiError. Keep the surface so payment screens continue to render; they
// handle the error and surface an "unavailable" state.

import { apiClient } from '../api/client';
import type {
  Subscription,
  Plan,
  PaymentMethod,
  Invoice,
  PaymentHistory,
  UsageData,
  Analytics,
  NotificationPreferences,
  SetupIntentResponse,
  CustomerPortalResponse,
  CostCalculatorParams,
  CostCalculatorResponse,
  SwitchPlanData,
  CancelSubscriptionData,
  ConfirmPaymentMethodData,
  CreateSubscriptionData,
  ActivateFreeTierData,
  PaginatedResponse,
} from '../types/BillingTypes';

export class BillingService {
  async getSubscriptions(): Promise<Subscription[]> {
    const response = await apiClient.get('/billing/subscriptions/');
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async getCurrentSubscription(): Promise<Subscription> {
    const response = await apiClient.get('/billing/subscriptions/current/');
    return response.data;
  }

  async switchPlan(data: SwitchPlanData): Promise<Subscription> {
    const response = await apiClient.post('/billing/subscriptions/switch_plan/', data);
    return response.data;
  }

  async cancelSubscription(data: CancelSubscriptionData = {}): Promise<Subscription> {
    const response = await apiClient.post('/billing/subscriptions/cancel_subscription/', {
      at_period_end: data.at_period_end ?? true,
    });
    return response.data;
  }

  async reactivateSubscription(): Promise<Subscription> {
    const response = await apiClient.post('/billing/subscriptions/reactivate_subscription/');
    return response.data;
  }

  async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    const response = await apiClient.post('/billing/create-subscription/', data);
    return response.data;
  }

  async activateFreeTier(data: ActivateFreeTierData = {}): Promise<Subscription> {
    const response = await apiClient.post('/billing/activate-free-tier/', data);
    return response.data;
  }

  async getInvoices(): Promise<PaginatedResponse<Invoice>> {
    const response = await apiClient.get('/billing/invoices/');
    return response.data;
  }

  async getInvoiceDownloadUrl(invoiceId: string): Promise<{ download_url: string }> {
    const response = await apiClient.get(`/billing/invoices/${invoiceId}/download_url/`);
    return response.data;
  }

  async getPaymentHistory(): Promise<PaymentHistory[]> {
    const response = await apiClient.get('/billing/payment-history/');
    return response.data;
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await apiClient.get('/billing/payment-methods/');
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    await apiClient.delete(`/billing/payment-methods/${paymentMethodId}/`);
  }

  async createSetupIntent(): Promise<SetupIntentResponse> {
    const response = await apiClient.post('/billing/setup-intent/');
    return response.data;
  }

  async confirmPaymentMethod(data: ConfirmPaymentMethodData): Promise<PaymentMethod> {
    const response = await apiClient.post('/billing/confirm-payment-method/', data);
    return response.data;
  }

  async createCustomerSession(): Promise<{
    customer_id: string;
    ephemeral_key_secret: string;
    setup_intent_client_secret?: string;
  }> {
    const response = await apiClient.post('/billing/customer-session/');
    return response.data;
  }

  async getUsage(): Promise<UsageData> {
    const response = await apiClient.get('/billing/usage/');
    return response.data;
  }

  async getAnalytics(): Promise<Analytics> {
    const response = await apiClient.get('/billing/analytics/');
    return response.data;
  }

  async calculateCost(params: CostCalculatorParams): Promise<CostCalculatorResponse> {
    const queryParams = new URLSearchParams({
      device_count: params.device_count.toString(),
      ...(params.plan_type && { plan_type: params.plan_type }),
    });
    const response = await apiClient.get(`/billing/calculate-cost/?${queryParams}`);
    return response.data;
  }

  async getPlans(): Promise<Plan[]> {
    const response = await apiClient.get('/billing/plans/');
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async createCustomerPortalSession(): Promise<CustomerPortalResponse> {
    const response = await apiClient.post('/billing/customer-portal/');
    return response.data;
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const response = await apiClient.get('/billing/notification-preferences/');
    return response.data;
  }

  async updateNotificationPreferences(
    data: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const response = await apiClient.put('/billing/notification-preferences/', data);
    return response.data;
  }

  async getBillingStatus(): Promise<UsageData> {
    return this.getUsage();
  }

  async changePlan(data: { new_cycle: string }): Promise<Subscription> {
    return this.switchPlan({
      plan_slug: data.new_cycle === 'annual' ? 'annual-device-billing' : 'monthly-device-billing',
      prorate: true,
    });
  }
}

export const billingService: BillingService = new BillingService();

// Kept for back-compat with existing `createBillingService(axiosInstance)`
// call sites; the argument is ignored because the service now uses the
// shared apiClient. Delete once every caller is migrated.
export const createBillingService = (_axiosInstance?: unknown): BillingService => billingService;

export default BillingService;
