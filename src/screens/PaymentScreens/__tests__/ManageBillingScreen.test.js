import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as billing from '../../../api/endpoints/billing';
import ManageBillingScreen from '../ManageBillingScreen';

jest.mock('../../../api/endpoints/billing');
jest.mock('../../../components/CustomerSheetManager', () => () => null);
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ isAdminOrOwner: true }),
}));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: new Proxy({}, { get: () => '#000000' }) }),
}));

const activeState = {
  status: 'active',
  tier: 'pro',
  cancel_at_period_end: false,
  in_grace_period: false,
  limits: {},
  credits: { balance: 0 },
  features: {},
  actions: { can_open_portal: false, needs_payment_method: false },
};

describe('ManageBillingScreen plan routing', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    billing.getInvoices.mockResolvedValue([]);
    billing.getPlans.mockResolvedValue({ plans: [], addons: {} });
    billing.getSubscription.mockResolvedValue({ source: null });
  });

  // 'Subscribe' is the Apple/Google in-app purchase screen, whose catalogue
  // is empty — Stripe plans are chosen and paid for on DataHandlingFee.
  it('"Set Up Billing" opens the Stripe plan checkout', async () => {
    billing.getBillingState.mockResolvedValue({ ...activeState, status: 'none' });
    const { findByText } = render(<ManageBillingScreen navigation={navigation} />);
    fireEvent.press(await findByText('Set Up Billing'));
    expect(navigation.navigate).toHaveBeenCalledWith('DataHandlingFee');
  });

  it('"Change Plan" without a portal opens the Stripe plan checkout', async () => {
    billing.getBillingState.mockResolvedValue(activeState);
    const { findByText } = render(<ManageBillingScreen navigation={navigation} />);
    fireEvent.press(await findByText('Change Plan'));
    expect(navigation.navigate).toHaveBeenCalledWith('DataHandlingFee');
  });
});
