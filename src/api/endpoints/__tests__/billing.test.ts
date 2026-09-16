import { apiClient } from '../../client';
import * as billing from '../billing';

jest.mock('../../client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const state = { tier: 'crew-control', status: 'active', cancel_at_period_end: false };

describe('billing endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /billing/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: state });
    await expect(billing.getBillingState()).resolves.toEqual(state);
    expect(apiClient.get).toHaveBeenCalledWith('/billing/');
  });

  it('GET /billing/invoices/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'in_1' }] });
    await expect(billing.listInvoices()).resolves.toEqual([{ id: 'in_1' }]);
    expect(apiClient.get).toHaveBeenCalledWith('/billing/invoices/');
  });

  it('POST /billing/customer-sheet/', async () => {
    const session = { customer_id: 'cus_1', ephemeral_key_secret: 'ek', setup_intent_client_secret: 'seti' };
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: session });
    await expect(billing.createCustomerSheetSession()).resolves.toEqual(session);
    expect(apiClient.post).toHaveBeenCalledWith('/billing/customer-sheet/');
  });

  it('POST /billing/payment-method/default/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: null });
    await billing.setDefaultPaymentMethod('pm_1');
    expect(apiClient.post).toHaveBeenCalledWith('/billing/payment-method/default/', {
      payment_method_id: 'pm_1',
    });
  });

  it('POST /billing/subscription/cancel/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { ...state, cancel_at_period_end: true } });
    const res = await billing.cancelSubscription();
    expect(apiClient.post).toHaveBeenCalledWith('/billing/subscription/cancel/');
    expect(res.cancel_at_period_end).toBe(true);
  });

  it('POST /billing/subscription/resume/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: state });
    await billing.resumeSubscription();
    expect(apiClient.post).toHaveBeenCalledWith('/billing/subscription/resume/');
  });
});
