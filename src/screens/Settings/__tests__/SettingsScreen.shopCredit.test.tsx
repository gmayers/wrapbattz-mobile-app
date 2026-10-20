import React from 'react';
import { SectionList } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';
import { getBillingState } from '../../../api/endpoints/billing';

let mockRole = 'owner';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { role: mockRole }, logout: jest.fn(), deleteAccount: jest.fn(), updateOnboarding: jest.fn() }),
}));
jest.mock('../../../api/endpoints', () => ({
  organizations: { createDemoData: jest.fn(), deleteDemoData: jest.fn() },
  account: { getOnboarding: jest.fn() },
}));
jest.mock('../../../api/endpoints/billing', () => ({ getBillingState: jest.fn() }));

// SectionList only renders the first rows in tests, so read what it was given.
const rowKeys = () =>
  screen.UNSAFE_getByType(SectionList).props.sections.flatMap((s: any) => s.data.map((r: any) => r.key));

const billing = (wallet_enabled: boolean) => ({ credits: { balance: 0, next_expiry: null, wallet_enabled } });

describe('Settings → Shop Credit row', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'owner';
  });

  it('shows for the owner once shop credit is on', async () => {
    (getBillingState as jest.Mock).mockResolvedValue(billing(true));
    render(<SettingsScreen />);
    await waitFor(() => expect(rowKeys()).toContain('shopCredit'));
  });

  it('stays hidden while shop credit is off or the backend predates it', async () => {
    (getBillingState as jest.Mock).mockResolvedValue({ credits: { balance: 0, next_expiry: null } });
    render(<SettingsScreen />);
    await waitFor(() => expect(getBillingState).toHaveBeenCalled());
    expect(rowKeys()).not.toContain('shopCredit');
  });

  it('stays hidden when billing state fails to load', async () => {
    (getBillingState as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<SettingsScreen />);
    await waitFor(() => expect(getBillingState).toHaveBeenCalled());
    expect(rowKeys()).not.toContain('shopCredit');
  });

  it("doesn't ask for billing state for other roles", () => {
    mockRole = 'admin';
    render(<SettingsScreen />);
    expect(getBillingState).not.toHaveBeenCalled();
  });
});
