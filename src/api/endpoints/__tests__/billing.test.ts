import { apiClient } from '../../client';
import * as billing from '../billing';
import { ApiError } from '../../errors';

jest.mock('../../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Paths asserted here are the ones in docs/api/openapi.json. If the server
// moves a route, these fail rather than the app 404-ing at runtime.

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

describe('billing state, plans and invoices', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /billing/ returns the org billing state', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: { status: 'active', tier: 'pro', limits: {}, credits: { balance: 0 }, actions: {} },
    });
    const res = await billing.getBillingState();
    expect(apiClient.get).toHaveBeenCalledWith('/billing/');
    expect(res.status).toBe('active');
  });

  it('GET /billing/plans/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: { plans: [{ slug: 'pro' }], addons: { devices: { unit_price_monthly: 40 } } },
    });
    const res = await billing.getPlans();
    expect(apiClient.get).toHaveBeenCalledWith('/billing/plans/');
    expect(res.addons.devices.unit_price_monthly).toBe(40);
  });

  // Production answers with singular keys ("seat", "device"); screens read the
  // plural ones, so add-on prices silently never rendered.
  it('GET /billing/plans/ normalises singular add-on keys from the server', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: {
        plans: [],
        addons: {
          seat: { unit_price_monthly: 500, currency: 'gbp' },
          device: { unit_price_monthly: 1000, currency: 'gbp' },
        },
      },
    });
    const res = await billing.getPlans();
    expect(res.addons.seats.unit_price_monthly).toBe(500);
    expect(res.addons.devices.unit_price_monthly).toBe(1000);
  });

  // The route answers with a bare array, not a paginated envelope.
  it('GET /billing/invoices/ returns a flat array', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'in_1', amount: 1200, status: 'paid' }],
    });
    const res = await billing.getInvoices();
    expect(apiClient.get).toHaveBeenCalledWith('/billing/invoices/');
    expect(res).toHaveLength(1);
  });

  it('coerces a non-array invoices body to an empty list', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { results: [] } });
    await expect(billing.getInvoices()).resolves.toEqual([]);
  });
});

describe('checkout, portal and payment methods', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /billing/checkout/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { client_secret: 'cs', amount: 1200, currency: 'gbp' },
    });
    const res = await billing.startCheckout({ plan_slug: 'pro', interval: 'annual' });
    expect(apiClient.post).toHaveBeenCalledWith('/billing/checkout/', {
      plan_slug: 'pro',
      interval: 'annual',
    });
    expect(res.client_secret).toBe('cs');
  });

  it('POST /billing/portal/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { url: 'https://portal' } });
    const res = await billing.openPortal();
    expect(apiClient.post).toHaveBeenCalledWith('/billing/portal/');
    expect(res.url).toBe('https://portal');
  });

  it('POST /billing/customer-sheet/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { customer_id: 'cus_1', ephemeral_key_secret: 'ek', setup_intent_client_secret: 'si' },
    });
    const res = await billing.createCustomerSheet();
    expect(apiClient.post).toHaveBeenCalledWith('/billing/customer-sheet/');
    expect(res.customer_id).toBe('cus_1');
  });

  it('POST /billing/payment-method/default/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: undefined });
    await billing.setDefaultPaymentMethod({ payment_method_id: 'pm_1' });
    expect(apiClient.post).toHaveBeenCalledWith('/billing/payment-method/default/', {
      payment_method_id: 'pm_1',
    });
  });
});

describe('subscription actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /billing/subscription/cancel/ returns refreshed state', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { status: 'active', cancel_at_period_end: true },
    });
    const res = await billing.cancelSubscription();
    expect(apiClient.post).toHaveBeenCalledWith('/billing/subscription/cancel/');
    expect(res.cancel_at_period_end).toBe(true);
  });

  it('POST /billing/subscription/resume/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { status: 'active', cancel_at_period_end: false },
    });
    const res = await billing.resumeSubscription();
    expect(apiClient.post).toHaveBeenCalledWith('/billing/subscription/resume/');
    expect(res.cancel_at_period_end).toBe(false);
  });
});

describe('add-ons', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /billing/add-ons/seats/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { ok: true, granted: 2 } });
    const res = await billing.buySeats(2);
    expect(apiClient.post).toHaveBeenCalledWith('/billing/add-ons/seats/', { seats: 2 });
    expect(res.granted).toBe(2);
  });

  // 402 is a real answer ("needs a card"), not a crash, and carries a body.
  it('unwraps a 402 needs-payment-method body into a result', async () => {
    const body = { ok: false, granted: 0, needs_payment_method: true, client_secret: 'cs' };
    (apiClient.post as jest.Mock).mockRejectedValueOnce(
      new ApiError({ code: 'unknown', status: 402, message: 'Payment required', detail: body })
    );
    const res = await billing.buyDevices(3);
    expect(res.needs_payment_method).toBe(true);
    expect(res.ok).toBe(false);
  });

  it('rethrows non-402 add-on failures', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(
      new ApiError({ code: 'forbidden', status: 403, message: 'Owner only' })
    );
    await expect(billing.buySeats(1)).rejects.toThrow('Owner only');
  });
});
