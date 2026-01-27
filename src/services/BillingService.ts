import axios, { AxiosInstance } from 'axios';
import {
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
  UpdateDeviceCountData,
  SetDefaultPaymentMethodData,
  ConfirmPaymentMethodData,
  CreateSubscriptionData,
  ActivateFreeTierData,
  BillingApiResponse,
  PaginatedResponse,
} from '../types/BillingTypes';

export class BillingService {
  private axiosInstance: AxiosInstance;

  constructor(axiosInstance: AxiosInstance) {
    this.axiosInstance = axiosInstance;
  }

  // Subscription Management
  async getSubscriptions(): Promise<Subscription[]> {
    const response = await this.axiosInstance.get('/billing/subscriptions/');
    return response.data;
  }

  async getCurrentSubscription(): Promise<Subscription> {
    const response = await this.axiosInstance.get('/billing/subscriptions/current/');
    return response.data;
  }

  async switchPlan(data: SwitchPlanData): Promise<Subscription> {
    const response = await this.axiosInstance.post('/billing/subscriptions/switch_plan/', data);
    return response.data;
  }

  async cancelSubscription(data: CancelSubscriptionData = {}): Promise<Subscription> {
    const response = await this.axiosInstance.post('/billing/subscriptions/cancel_subscription/', {
      at_period_end: data.at_period_end ?? true,
    });
    return response.data;
  }

  async reactivateSubscription(): Promise<Subscription> {
    const response = await this.axiosInstance.post('/billing/subscriptions/reactivate_subscription/');
    return response.data;
  }

  async updateDeviceCount(data: UpdateDeviceCountData): Promise<Subscription> {
    const response = await this.axiosInstance.post('/billing/subscriptions/update_device_count/', data);
    return response.data;
  }

  async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    const response = await this.axiosInstance.post('/billing/create-subscription/', data);
    return response.data;
  }

  async activateFreeTier(data: ActivateFreeTierData = {}): Promise<Subscription> {
    const response = await this.axiosInstance.post('/billing/activate-free-tier/', data);
    return response.data;
  }

  // Invoice & Payment History
  async getInvoices(): Promise<PaginatedResponse<Invoice>> {
    const response = await this.axiosInstance.get('/billing/invoices/');
    return response.data;
  }

  /**
   * Get the download URL for a specific invoice
   * @param invoiceId - The Stripe invoice ID
   * @returns Object with download_url property
   *
   * Note: Most use cases should use invoice.hosted_invoice_url or invoice.invoice_pdf
   * directly with expo-web-browser. This method is provided for cases where the backend
   * needs to process or customize the invoice URL.
   */
  async getInvoiceDownloadUrl(invoiceId: string): Promise<{ download_url: string }> {
    const response = await this.axiosInstance.get(`/billing/invoices/${invoiceId}/download_url/`);
    return response.data;
  }

  async getPaymentHistory(): Promise<PaymentHistory[]> {
    const response = await this.axiosInstance.get('/billing/payment-history/');
    return response.data;
  }

  // Payment Methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await this.axiosInstance.get('/billing/payment-methods/');
    return response.data;
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    await this.axiosInstance.delete(`/billing/payment-methods/${paymentMethodId}/`);
  }

  async createSetupIntent(): Promise<SetupIntentResponse> {
    const response = await this.axiosInstance.post('/billing/setup-intent/');
    return response.data;
  }

  async confirmPaymentMethod(data: ConfirmPaymentMethodData): Promise<PaymentMethod> {
    const response = await this.axiosInstance.post('/billing/confirm-payment-method/', data);
    return response.data;
  }

  async createCustomerSession(): Promise<{
    customer_id: string;
    ephemeral_key_secret: string;
    setup_intent_client_secret?: string;
  }> {
    // Use the same endpoint as createSetupIntent - it now returns full customer session data
    const response = await this.axiosInstance.post('/billing/setup-intent/');
    return response.data;
  }

  // Billing Dashboard & Analytics
  async getUsage(): Promise<UsageData> {
    const response = await this.axiosInstance.get('/billing/usage/');
    return response.data;
  }

  async getAnalytics(): Promise<Analytics> {
    const response = await this.axiosInstance.get('/billing/analytics/');
    return response.data;
  }

  async calculateCost(params: CostCalculatorParams): Promise<CostCalculatorResponse> {
    const queryParams = new URLSearchParams({
      device_count: params.device_count.toString(),
      ...(params.plan_type && { plan_type: params.plan_type }),
    });
    const response = await this.axiosInstance.get(`/billing/calculate-cost/?${queryParams}`);
    return response.data;
  }

  // Plan Management
  async getPlans(): Promise<Plan[]> {
    const response = await this.axiosInstance.get('/billing/plans/');
    return response.data;
  }

  // Customer Portal
  async createCustomerPortalSession(): Promise<CustomerPortalResponse> {
    const response = await this.axiosInstance.post('/billing/customer-portal/');
    return response.data;
  }

  // Notification Preferences
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const response = await this.axiosInstance.get('/billing/notification-preferences/');
    return response.data;
  }

  async updateNotificationPreferences(data: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const response = await this.axiosInstance.put('/billing/notification-preferences/', data);
    return response.data;
  }

  // Diagnostics
  async getDiagnostics(): Promise<any> {
    const response = await this.axiosInstance.get('/billing/diagnostics/');
    return response.data;
  }

  // Legacy endpoints for compatibility
  async getBillingStatus(): Promise<UsageData> {
    try {
      return await this.getUsage();
    } catch (error) {
      // Fallback to legacy endpoint if new one doesn't exist yet
      const response = await this.axiosInstance.get('/billing/status/');
      return response.data;
    }
  }

  async createPortalSession(): Promise<CustomerPortalResponse> {
    try {
      return await this.createCustomerPortalSession();
    } catch (error) {
      // Fallback to legacy endpoint
      const response = await this.axiosInstance.post('/billing/create-portal-session/');
      return response.data;
    }
  }

  async changePlan(data: { new_cycle: string }): Promise<Subscription> {
    return await this.switchPlan({
      plan_slug: data.new_cycle === 'annual' ? 'annual-device-billing' : 'monthly-device-billing',
      prorate: true
    });
  }

  async cancelSubscriptionLegacy(): Promise<Subscription> {
    return await this.cancelSubscription();
  }
}

// Singleton instance management
let billingServiceInstance: BillingService | null = null;

/**
 * Create or get the BillingService singleton instance
 * @param axiosInstance - Required for initial creation, optional afterwards
 * @returns BillingService singleton instance
 */
export const createBillingService = (axiosInstance: AxiosInstance): BillingService => {
  if (!billingServiceInstance) {
    billingServiceInstance = new BillingService(axiosInstance);
  }
  return billingServiceInstance;
};

/**
 * Get the BillingService singleton instance
 * @throws Error if service not initialized
 * @returns BillingService singleton instance
 */
export const getBillingService = (): BillingService => {
  if (!billingServiceInstance) {
    throw new Error('BillingService not initialized. Call createBillingService first.');
  }
  return billingServiceInstance;
};

/**
 * Import this directly for components that need BillingService
 * The instance will be lazy-initialized on first use via AuthContext
 */
export const billingService: BillingService = new Proxy({} as BillingService, {
  get: (target, prop) => {
    if (!billingServiceInstance) {
      // Will be initialized by AuthContext or first component that uses it
      // For now, return undefined and let the component handle initialization
      throw new Error('BillingService not initialized. Ensure AuthContext has initialized the service.');
    }
    return (billingServiceInstance as any)[prop];
  }
});

export default BillingService;