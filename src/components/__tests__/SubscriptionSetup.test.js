import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initStripe } from '@stripe/stripe-react-native';
import { startCheckout } from '../../api/endpoints/billing';
import SubscriptionSetup from '../SubscriptionSetup';

const mockInitPaymentSheet = jest.fn().mockResolvedValue({});
const mockPresentPaymentSheet = jest.fn().mockResolvedValue({});
jest.mock('@stripe/stripe-react-native', () => ({
  initStripe: jest.fn().mockResolvedValue(undefined),
  usePaymentSheet: () => ({
    initPaymentSheet: mockInitPaymentSheet,
    presentPaymentSheet: mockPresentPaymentSheet,
  }),
}));

jest.mock('../../api/endpoints/billing', () => ({ startCheckout: jest.fn() }));

describe('SubscriptionSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    startCheckout.mockResolvedValue({
      client_secret: 'pi_123_secret_abc',
      publishable_key: 'pk_live_from_server',
      customer_id: 'cus_1',
      subscription_id: 'sub_1',
      ephemeral_key: 'ek_1',
      amount: 1200,
      currency: 'gbp',
    });
  });

  // The app bundle's production key is a placeholder, and a build's key can
  // point at a different Stripe account than the server — either way the
  // sheet fails. Checkout returns the key its objects belong to; use it.
  it('initialises Stripe with the publishable key the checkout returned', async () => {
    render(<SubscriptionSetup planSlug="pro" interval="monthly" planName="Pro" />);
    await act(async () => {});

    expect(initStripe).toHaveBeenCalledWith(
      expect.objectContaining({ publishableKey: 'pk_live_from_server' })
    );
    expect(initStripe.mock.invocationCallOrder[0])
      .toBeLessThan(mockInitPaymentSheet.mock.invocationCallOrder[0]);
  });

  // Android registers only the "tooltraq" scheme; a wrapbattz:// return URL
  // strands the user in the browser after 3-D Secure.
  it('uses the app scheme that Android actually registers for the return URL', async () => {
    render(<SubscriptionSetup planSlug="pro" interval="monthly" planName="Pro" />);
    await act(async () => {});

    expect(mockInitPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({ returnURL: 'tooltraq://stripe-redirect' })
    );
  });
});
