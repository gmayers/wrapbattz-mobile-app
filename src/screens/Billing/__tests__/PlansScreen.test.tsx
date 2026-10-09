import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as billing from '../../../api/endpoints/billing';
import PlansScreen from '../PlansScreen';

jest.mock('../../../api/endpoints/billing');
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#000', surface: '#111', card: '#111', border: '#333', primary: '#FFB300',
      onPrimary: '#000', textPrimary: '#fff', textSecondary: '#ddd', textMuted: '#ccc', error: '#f00',
    },
  }),
}));

const plan = (over: object) => ({
  slug: 'solo-control', name: 'Solo Control', subhead: 'The one-van operator',
  selling_points: ['Track every tool across your van'],
  monthly_price: 799, annual_price: 7999, currency: 'gbp',
  included_seats: 1, included_devices: 50, included_credits: 5, features: {},
  ...over,
});

const catalog = {
  plans: [
    plan({}),
    plan({
      slug: 'full-control', name: 'Full Control', subhead: 'Larger operations',
      selling_points: ['Unlimited tools and seats'],
      monthly_price: null, annual_price: null, included_seats: 0, included_devices: 0,
    }),
  ],
  addons: {},
};

describe('PlansScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (billing.getPlans as jest.Mock).mockResolvedValue(catalog);
  });

  it('shows live plans with monthly prices and what is included', async () => {
    const { findByText, getByText } = render(<PlansScreen />);
    expect(await findByText('Solo Control')).toBeTruthy();
    expect(getByText('£7.99')).toBeTruthy();
    expect(getByText('1 user · 50 tools')).toBeTruthy();
    expect(getByText('Track every tool across your van')).toBeTruthy();
  });

  it('switches to annual pricing', async () => {
    const { findByText, getByText } = render(<PlansScreen />);
    fireEvent.press(await findByText('Annual'));
    expect(getByText('£79.99')).toBeTruthy();
    expect(getByText('per year')).toBeTruthy();
  });

  it('shows unpriced, unlimited plans as contact us', async () => {
    const { findByText, getByText } = render(<PlansScreen />);
    expect(await findByText('Full Control')).toBeTruthy();
    expect(getByText('Contact us')).toBeTruthy();
    expect(getByText('Unlimited users · Unlimited tools')).toBeTruthy();
  });

  it('has no purchase button', async () => {
    const { findByText, queryByText } = render(<PlansScreen />);
    await findByText('Solo Control');
    expect(queryByText(/subscribe|buy|choose plan/i)).toBeNull();
  });

  it('retries after a load failure', async () => {
    (billing.getPlans as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    const { findByText } = render(<PlansScreen />);
    fireEvent.press(await findByText('Try again'));
    await waitFor(() => expect(billing.getPlans).toHaveBeenCalledTimes(2));
    expect(await findByText('Solo Control')).toBeTruthy();
  });
});
