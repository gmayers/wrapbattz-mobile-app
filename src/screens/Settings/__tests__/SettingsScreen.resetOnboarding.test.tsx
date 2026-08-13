import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';

const mockNavigate = jest.fn();
const mockUpdateOnboarding = jest.fn();
const mockGetOnboarding = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    userData: { role: 'site_worker' },
    logout: jest.fn(),
    deleteAccount: jest.fn(),
    updateOnboarding: mockUpdateOnboarding,
  }),
}));

jest.mock('../../../api/endpoints', () => ({
  organizations: { createDemoData: jest.fn(), deleteDemoData: jest.fn() },
  account: { getOnboarding: (...a: unknown[]) => mockGetOnboarding(...a) },
}));

/** Press the confirm button of the most recent Alert.alert call. */
const pressConfirm = async () => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)![2];
  const confirm = buttons.find((b: { text: string }) => b.text !== 'Cancel');
  await confirm.onPress();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGetOnboarding.mockResolvedValue({ steps: [{ key: 'welcome' }, { key: 'company' }] });
  mockUpdateOnboarding.mockResolvedValue({});
});

describe('Reset Onboarding', () => {
  it('confirms before doing anything', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockUpdateOnboarding).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('resets all three flags using the first step from the user flow', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() => expect(mockUpdateOnboarding).toHaveBeenCalledWith({
      has_completed_onboarding: false,
      has_seen_onboarding_outro: false,
      onboarding_step: 'welcome',
    }));
    expect(mockNavigate).toHaveBeenCalledWith('OnboardingWizard');
  });

  it('does not navigate when the reset fails', async () => {
    mockUpdateOnboarding.mockRejectedValue(new Error('network is down'));

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'network is down'),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('still resets when the flow lookup fails, without navigating blind', async () => {
    mockGetOnboarding.mockRejectedValue(new Error('offline'));

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'offline'));
    expect(mockUpdateOnboarding).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('touches no organisation data', async () => {
    const { organizations } = require('../../../api/endpoints');

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() => expect(mockUpdateOnboarding).toHaveBeenCalled());
    expect(organizations.createDemoData).not.toHaveBeenCalled();
    expect(organizations.deleteDemoData).not.toHaveBeenCalled();
  });
});
