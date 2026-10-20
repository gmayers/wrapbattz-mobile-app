import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as billing from '../../../api/endpoints/billing';
import ShopCreditScreen from '../ShopCreditScreen';

jest.mock('../../../api/endpoints/billing');
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#000', surface: '#111', border: '#333', primary: '#FFB300',
      textPrimary: '#fff', textSecondary: '#aaa', textMuted: '#888', error: '#f00',
    },
  }),
}));

const credit = {
  wallet_enabled: true,
  balance_pence: 450,
  balance_display: '£4.50',
  next_expiry: '2026-12-31T00:00:00Z',
  store_url: 'https://battwrapz.com/',
  held_by_you: true,
  holder_name: 'Olive Owner',
  history: [
    { date: '2026-10-16T09:00:00Z', kind: 'added', credits: 15, amount_pence: 450, amount_display: '£4.50', expires_at: '2026-12-31T00:00:00Z', pending: false },
    { date: '2026-09-30T09:00:00Z', kind: 'expired', credits: -10, amount_pence: 120, amount_display: '£1.20', expires_at: null, pending: false },
  ],
};

describe('ShopCreditScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (billing.getStoreCredit as jest.Mock).mockResolvedValue(credit);
  });

  it('shows the balance, expiry and history', async () => {
    const { findByTestId, getByText } = render(<ShopCreditScreen />);
    expect((await findByTestId('shop-credit-balance')).props.children).toBe('£4.50');
    expect(getByText(/expires on 31 Dec 2026/)).toBeTruthy();
    expect(getByText('Monthly credit added')).toBeTruthy();
    expect(getByText('+£4.50')).toBeTruthy();
    expect(getByText('Unspent credit expired')).toBeTruthy();
    expect(getByText('−£1.20')).toBeTruthy();
  });

  it('fetches a fresh sign-in link and opens the shop', async () => {
    (billing.createStoreLink as jest.Mock).mockResolvedValue({ url: 'https://battwrapz.com/?tooltraq_login=abc', signs_in: true });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { findByText } = render(<ShopCreditScreen />);
    fireEvent.press(await findByText('Spend in store'));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://battwrapz.com/?tooltraq_login=abc'));
  });

  it('says so when the shop link fails', async () => {
    (billing.createStoreLink as jest.Mock).mockRejectedValue(new Error('Network error'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { findByText } = render(<ShopCreditScreen />);
    fireEvent.press(await findByText('Spend in store'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Couldn't open the shop", 'Network error'));
  });

  it('shows "unavailable" rather than £0 when the shop is down', async () => {
    (billing.getStoreCredit as jest.Mock).mockResolvedValue({ ...credit, balance_pence: null, balance_display: null });
    const { findByText, queryByTestId } = render(<ShopCreditScreen />);
    expect(await findByText(/isn't available right now/)).toBeTruthy();
    expect(queryByTestId('shop-credit-balance')).toBeNull();
  });

  it('names the holder instead of a spend button for someone else', async () => {
    (billing.getStoreCredit as jest.Mock).mockResolvedValue({ ...credit, held_by_you: false });
    const { findByText, queryByText } = render(<ShopCreditScreen />);
    expect(await findByText(/Olive Owner's shop account/)).toBeTruthy();
    expect(queryByText('Spend in store')).toBeNull();
  });

  it('explains an empty history', async () => {
    (billing.getStoreCredit as jest.Mock).mockResolvedValue({ ...credit, balance_display: '£0.00', history: [] });
    expect(await render(<ShopCreditScreen />).findByText(/No credit yet/)).toBeTruthy();
  });

  it('shows a holding message while shop credit is off', async () => {
    (billing.getStoreCredit as jest.Mock).mockResolvedValue({ ...credit, wallet_enabled: false });
    expect(await render(<ShopCreditScreen />).findByText(/isn't available yet/)).toBeTruthy();
  });

  it('offers a retry when loading fails', async () => {
    (billing.getStoreCredit as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    const { findByText } = render(<ShopCreditScreen />);
    fireEvent.press(await findByText('Try again'));
    expect(await findByText('Spend in store')).toBeTruthy();
  });
});
