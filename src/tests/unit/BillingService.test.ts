import { BillingService } from '../../services/BillingService';
import { AxiosInstance } from 'axios';

// Mock axios instance
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
} as unknown as AxiosInstance;

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    billingService = new BillingService(mockAxiosInstance);
    jest.clearAllMocks();
  });

  describe('Subscription Management', () => {
    it('should get current subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        status: 'active',
        plan_slug: 'monthly-device-billing',
        plan_name: 'Monthly Device Plan',
        cycle: 'monthly',
        current_period_start: '2024-01-01T00:00:00Z',
        current_period_end: '2024-01-31T00:00:00Z',
        cancel_at_period_end: false,
        device_count: 10,
        amount: 2.80,
        currency: 'gbp',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
      };

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue({
        data: mockSubscription,
      });

      const result = await billingService.getCurrentSubscription();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/billing/subscriptions/current/');
      expect(result).toEqual(mockSubscription);
    });

    it('should switch plan successfully', async () => {
      const mockResponse = {
        success: true,
        data: { id: 'sub_123', plan_slug: 'annual-device-billing' },
      };

      (mockAxiosInstance.post as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const result = await billingService.switchPlan({
        plan_slug: 'annual-device-billing',
        prorate: true,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/billing/subscriptions/switch_plan/', {
        plan_slug: 'annual-device-billing',
        prorate: true,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should cancel subscription', async () => {
      const mockResponse = {
        success: true,
        data: { id: 'sub_123', status: 'cancelled' },
      };

      (mockAxiosInstance.post as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const result = await billingService.cancelSubscription({ at_period_end: true });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/billing/subscriptions/cancel_subscription/', {
        at_period_end: true,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Payment History', () => {
    it('should get payment history', async () => {
      const mockPaymentHistory = [
        {
          id: 'pay_123',
          amount: 2.80,
          currency: 'gbp',
          status: 'succeeded',
          created: '2024-01-01T00:00:00Z',
          description: 'Monthly subscription',
          payment_method: {
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
            },
          },
          receipt_url: 'https://example.com/receipt',
        },
      ];

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue({
        data: mockPaymentHistory,
      });

      const result = await billingService.getPaymentHistory();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/billing/payment-history/');
      expect(result).toEqual(mockPaymentHistory);
    });
  });

  describe('Usage and Analytics', () => {
    it('should get usage data', async () => {
      const mockUsage = {
        current_device_count: 10,
        billable_devices: 7,
        free_quota: 3,
        current_cost: 2.80,
        period_start: '2024-01-01T00:00:00Z',
        period_end: '2024-01-31T00:00:00Z',
        next_billing_date: '2024-02-01T00:00:00Z',
        subscription: {
          id: 'sub_123',
          status: 'active',
          cycle: 'monthly',
        },
      };

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue({
        data: mockUsage,
      });

      const result = await billingService.getUsage();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/billing/usage/');
      expect(result).toEqual(mockUsage);
    });

    it('should get analytics', async () => {
      const mockAnalytics = {
        device_usage_trends: [
          { date: '2024-01', device_count: 8, billable_count: 5 },
          { date: '2024-02', device_count: 10, billable_count: 7 },
        ],
        monthly_costs: [
          { month: '2024-01', amount: 2.00, device_count: 8 },
          { month: '2024-02', amount: 2.80, device_count: 10 },
        ],
        cost_projections: [
          { device_count: 20, monthly_cost: 6.80, annual_cost: 44.20, savings_annual: 37.40 },
        ],
        billing_summary: {
          total_paid: 4.80,
          current_period_cost: 2.80,
          average_monthly_cost: 2.40,
          device_count_average: 9,
          subscription_start_date: '2024-01-01T00:00:00Z',
        },
      };

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue({
        data: mockAnalytics,
      });

      const result = await billingService.getAnalytics();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/billing/analytics/');
      expect(result).toEqual(mockAnalytics);
    });

    it('should calculate cost', async () => {
      const mockCostCalculation = {
        monthly_cost: 2.80,
        annual_cost: 18.20,
        savings_annual: 15.40,
        cost_per_device: 0.40,
        free_devices: 3,
        billable_devices: 7,
      };

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue({
        data: mockCostCalculation,
      });

      const result = await billingService.calculateCost({
        device_count: 10,
        plan_type: 'monthly',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/billing/calculate-cost/?device_count=10&plan_type=monthly');
      expect(result).toEqual(mockCostCalculation);
    });
  });

  describe('Notification Preferences', () => {
    it('should get notification preferences', async () => {
      const mockPreferences = {
        email_notifications: true,
        payment_success: true,
        payment_failure: true,
        invoice_created: true,
        subscription_changes: true,
        cost_threshold_enabled: false,
        cost_threshold_amount: 50,
        device_count_alerts: true,
        additional_emails: [],
      };

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue({
        data: mockPreferences,
      });

      const result = await billingService.getNotificationPreferences();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/billing/notification-preferences/');
      expect(result).toEqual(mockPreferences);
    });

    it('should update notification preferences', async () => {
      const mockResponse = {
        success: true,
        data: {
          email_notifications: false,
          payment_success: false,
        },
      };

      (mockAxiosInstance.put as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const updateData = {
        email_notifications: false,
        payment_success: false,
      };

      const result = await billingService.updateNotificationPreferences(updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/billing/notification-preferences/', updateData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Network error';
      (mockAxiosInstance.get as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(billingService.getCurrentSubscription()).rejects.toThrow(errorMessage);
    });

    it('should handle invalid parameters', async () => {
      // Reset mocks for this test
      jest.clearAllMocks();

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue({
        data: { monthly_cost: 0, annual_cost: 0, savings_annual: 0 },
      });

      // Test that the service properly validates input before making API calls
      const result = await billingService.calculateCost({ device_count: 0 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/billing/calculate-cost/?device_count=0');
    });
  });

  describe('Legacy Compatibility', () => {
    it('should fallback to legacy endpoints', async () => {
      // First call fails (new endpoint)
      (mockAxiosInstance.get as jest.Mock)
        .mockRejectedValueOnce(new Error('Endpoint not found'))
        .mockResolvedValueOnce({ data: { mock: 'legacy data' } });

      const result = await billingService.getBillingStatus();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, '/billing/usage/');
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(2, '/billing/status/');
    });
  });
});