import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as billing from '../../../api/endpoints/billing';
import { manageCard } from '../manageCard';
import SubscriptionScreen from '../SubscriptionScreen';

jest.mock('../../../api/endpoints/billing');
jest.mock('../manageCard', () => ({ manageCard: jest.fn() }));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#000', surface: '#111', border: '#333', primary: '#FFB300',
      textPrimary: '#fff', textSecondary: '#aaa', textMuted: '#888', error: '#f00',
    },
  }),
}));

const limit = { included: 5, addon: 0, limit: 5, used: 2, remaining: 3 };
const active = {
  tier: 'crew-control', status: 'active', trial_ends_at: null,
  current_period_end: '2026-10-16T00:00:00Z', cancel_at_period_end: false,
  billing_interval: 'monthly', in_grace_period: false, grace_ends_at: null,
  limits: { seats: limit, devices: { ...limit, limit: 50, used: 12 } },
  credits: { balance: 0, next_expiry: null }, features: {},
  stripe_customer_id: 'cus_1',
  actions: { can_upgrade: true, can_buy_seats: true, can_buy_devices: true, can_open_portal: true, needs_payment_method: false },
};

describe('SubscriptionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (billing.getBillingState as jest.Mock).mockResolvedValue(active);
    (billing.listInvoices as jest.Mock).mockResolvedValue([
      { id: 'in_1', number: 'TT-0001', amount: 2900, status: 'paid', hosted_invoice_url: null, pdf_url: 'https://pay.stripe.com/x.pdf', created_at: '2026-09-16T00:00:00Z' },
    ]);
  });

  it('shows plan, renewal date and usage', async () => {
    const { findByText, getByText } = render(<SubscriptionScreen />);
    expect(await findByText('crew-control')).toBeTruthy();
    expect(getByText(/Renews 16 Oct 2026/)).toBeTruthy();
    expect(getByText('Seats: 2 of 5')).toBeTruthy();
    expect(getByText('Tools: 12 of 50')).toBeTruthy();
  });

  it('lists invoices and opens the PDF', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { findByText } = render(<SubscriptionScreen />);
    fireEvent.press(await findByText(/TT-0001/));
    expect(openURL).toHaveBeenCalledWith('https://pay.stripe.com/x.pdf');
  });

  it('cancels after confirmation and shows the end date', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    (billing.cancelSubscription as jest.Mock).mockResolvedValue({ ...active, cancel_at_period_end: true });
    const { findByText } = render(<SubscriptionScreen />);
    fireEvent.press(await findByText('Cancel subscription'));
    await waitFor(() => expect(billing.cancelSubscription).toHaveBeenCalled());
    expect(await findByText(/Ends 16 Oct 2026/)).toBeTruthy();
    expect(await findByText('Resume subscription')).toBeTruthy();
  });

  it('resumes a pending cancellation', async () => {
    (billing.getBillingState as jest.Mock).mockResolvedValue({ ...active, cancel_at_period_end: true });
    (billing.resumeSubscription as jest.Mock).mockResolvedValue(active);
    const { findByText } = render(<SubscriptionScreen />);
    fireEvent.press(await findByText('Resume subscription'));
    await waitFor(() => expect(billing.resumeSubscription).toHaveBeenCalled());
    expect(await findByText('Cancel subscription')).toBeTruthy();
  });

  it('opens card management', async () => {
    (manageCard as jest.Mock).mockResolvedValue('updated');
    const { findByText } = render(<SubscriptionScreen />);
    fireEvent.press(await findByText('Manage payment card'));
    await waitFor(() => expect(manageCard).toHaveBeenCalled());
  });

  it('trial org: explains subscriptions are set up on the web, no buy button or link', async () => {
    (billing.getBillingState as jest.Mock).mockResolvedValue({
      ...active, status: 'trialing', stripe_customer_id: null,
      actions: { ...active.actions, can_open_portal: false, needs_payment_method: true },
    });
    (billing.listInvoices as jest.Mock).mockResolvedValue([]);
    const { findByText, queryByText } = render(<SubscriptionScreen />);
    expect(await findByText('Subscriptions are managed at app.tooltraq.com')).toBeTruthy();
    expect(queryByText('Manage payment card')).toBeNull();
    expect(queryByText('Cancel subscription')).toBeNull();
  });

  it('shows an error with retry when loading fails', async () => {
    (billing.getBillingState as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const { findByText } = render(<SubscriptionScreen />);
    fireEvent.press(await findByText('Try again'));
    expect(await findByText('crew-control')).toBeTruthy();
  });
});
