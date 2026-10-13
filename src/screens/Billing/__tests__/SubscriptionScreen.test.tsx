import React from 'react';
import { Alert, Linking, Platform } from 'react-native';
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

const limit = { included: 5, addon: 0, limit: 5, used: 2, remaining: 3, unlimited: false, pending: 0 };
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
    (billing.getSubscriptionSource as jest.Mock).mockResolvedValue({ source: 'stripe', status: 'active', managed_in: 'stripe_portal' });
    (billing.listInvoices as jest.Mock).mockResolvedValue([
      { id: 'in_1', number: 'TT-0001', amount: 2900, status: 'paid', hosted_invoice_url: null, pdf_url: 'https://pay.stripe.com/x.pdf', created_at: '2026-09-16T00:00:00Z' },
    ]);
  });

  it('shows plan, renewal date and usage', async () => {
    const { findByText, getByText } = render(<SubscriptionScreen />);
    expect(await findByText('Crew Control')).toBeTruthy();
    expect(getByText('Status: Active')).toBeTruthy();
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

  it('trial org: neutral no-subscription copy, no buy button or link', async () => {
    (billing.getBillingState as jest.Mock).mockResolvedValue({
      ...active, status: 'trial', stripe_customer_id: null,
      actions: { ...active.actions, can_open_portal: false, needs_payment_method: true },
    });
    (billing.listInvoices as jest.Mock).mockResolvedValue([]);
    const { findByText, queryByText } = render(<SubscriptionScreen />);
    expect(await findByText("Your organisation doesn't have an active subscription.")).toBeTruthy();
    expect(queryByText('Manage payment card')).toBeNull();
    expect(queryByText('Cancel subscription')).toBeNull();
  });

  it('no subscription on Android: links to the read-only plans list', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    try {
      (billing.getBillingState as jest.Mock).mockResolvedValue({ ...active, status: 'trial', stripe_customer_id: null });
      (billing.listInvoices as jest.Mock).mockResolvedValue([]);
      const navigation = { navigate: jest.fn() };
      const { findByText } = render(<SubscriptionScreen navigation={navigation} />);
      fireEvent.press(await findByText('View plans'));
      expect(navigation.navigate).toHaveBeenCalledWith('Plans');
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    }
  });

  it('active subscription on Android: plans are one tap away to compare', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    try {
      const navigation = { navigate: jest.fn() };
      const { findByText } = render(<SubscriptionScreen navigation={navigation} />);
      fireEvent.press(await findByText('View plans'));
      expect(navigation.navigate).toHaveBeenCalledWith('Plans');
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    }
  });

  it('no subscription on iOS: no plans link', async () => {
    (billing.getBillingState as jest.Mock).mockResolvedValue({ ...active, status: 'trial', stripe_customer_id: null });
    (billing.listInvoices as jest.Mock).mockResolvedValue([]);
    const { findByText, queryByText } = render(<SubscriptionScreen navigation={{ navigate: jest.fn() }} />);
    await findByText("Your organisation doesn't have an active subscription.");
    expect(queryByText('View plans')).toBeNull();
  });

  it('unlimited plans say so instead of "of null"', async () => {
    (billing.getBillingState as jest.Mock).mockResolvedValue({
      ...active,
      limits: { ...active.limits, devices: { ...limit, used: 12, limit: null, remaining: null, unlimited: true } },
    });
    const { findByText, queryByText } = render(<SubscriptionScreen />);
    expect(await findByText('Tools: 12 (unlimited)')).toBeTruthy();
    expect(queryByText(/null/)).toBeNull();
  });

  it('App Store subscription: points to the store, no Stripe actions', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    (billing.getBillingState as jest.Mock).mockResolvedValue({ ...active, stripe_customer_id: null });
    (billing.getSubscriptionSource as jest.Mock).mockResolvedValue({ source: 'apple_iap', status: 'active', managed_in: 'app_store' });
    const { findByText, queryByText, getByText } = render(<SubscriptionScreen />);
    fireEvent.press(await findByText('Manage in the App Store'));
    expect(openURL).toHaveBeenCalledWith('https://apps.apple.com/account/subscriptions');
    expect(getByText(/Renews 16 Oct 2026/)).toBeTruthy();
    expect(queryByText("Your organisation doesn't have an active subscription.")).toBeNull();
    expect(queryByText('Manage payment card')).toBeNull();
    expect(queryByText('Cancel subscription')).toBeNull();
  });

  it('Play subscription with a leftover Stripe customer: no Stripe cancel', async () => {
    (billing.getSubscriptionSource as jest.Mock).mockResolvedValue({ source: 'google_iap', status: 'active', managed_in: 'play_store' });
    const { findByText, queryByText } = render(<SubscriptionScreen />);
    expect(await findByText('Manage in Google Play')).toBeTruthy();
    expect(queryByText('Cancel subscription')).toBeNull();
  });

  it('falls back to Stripe when the source lookup fails', async () => {
    (billing.getSubscriptionSource as jest.Mock).mockRejectedValue(new Error('offline'));
    const { findByText } = render(<SubscriptionScreen />);
    expect(await findByText('Manage payment card')).toBeTruthy();
  });

  it('unfinished checkout is not described as ended', async () => {
    (billing.getBillingState as jest.Mock).mockResolvedValue({ ...active, status: 'incomplete' });
    const { findByText, queryByText } = render(<SubscriptionScreen />);
    expect(await findByText("Your first payment hasn't gone through yet.")).toBeTruthy();
    expect(queryByText('Your subscription has ended.')).toBeNull();
    expect(queryByText('Cancel subscription')).toBeNull();
  });

  it('grace period: lapsed with access date, no actions shown', async () => {
    (billing.getBillingState as jest.Mock).mockResolvedValue({
      ...active, status: 'grace', cancel_at_period_end: true, in_grace_period: true,
      grace_ends_at: '2026-10-30T00:00:00Z',
    });
    const { findByText, queryByText } = render(<SubscriptionScreen />);
    expect(await findByText('Your subscription has lapsed. Full access continues until 30 Oct 2026.')).toBeTruthy();
    expect(queryByText('Manage payment card')).toBeNull();
    expect(queryByText('Cancel subscription')).toBeNull();
    expect(queryByText('Resume subscription')).toBeNull();
    expect(queryByText(/Ends /)).toBeNull();
    expect(queryByText(/Renews /)).toBeNull();
  });

  it('canceled: subscription ended, no actions shown', async () => {
    (billing.getBillingState as jest.Mock).mockResolvedValue({
      ...active, status: 'canceled',
    });
    const { findByText, queryByText } = render(<SubscriptionScreen />);
    expect(await findByText('Your subscription has ended.')).toBeTruthy();
    expect(queryByText('Manage payment card')).toBeNull();
    expect(queryByText('Cancel subscription')).toBeNull();
    expect(queryByText('Resume subscription')).toBeNull();
  });

  it('shows an error with retry when loading fails', async () => {
    (billing.getBillingState as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const { findByText } = render(<SubscriptionScreen />);
    fireEvent.press(await findByText('Try again'));
    expect(await findByText('Crew Control')).toBeTruthy();
  });
});
