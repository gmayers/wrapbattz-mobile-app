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

    // There is no explicit navigate() call to assert: has_completed_onboarding:
    // false is what flips the onboarding gate in navigation/index.tsx, which
    // re-renders the app into the wizard on its own. This assertion pins that
    // real mechanism directly.
    await waitFor(() => expect(mockUpdateOnboarding).toHaveBeenCalledWith({
      has_completed_onboarding: false,
      has_seen_onboarding_outro: false,
      onboarding_step: 'welcome',
    }));
  });

  it('surfaces the error via Alert when the reset PATCH fails, without a false completion', async () => {
    mockUpdateOnboarding.mockRejectedValue(new Error('network is down'));

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'network is down'),
    );
    // The real updateOnboarding only flips has_completed_onboarding (the
    // gate that re-renders into the wizard) once its PATCH resolves. Since
    // it rejected here, that never happens, and the handler must not retry
    // or otherwise paper over the failure.
    expect(mockUpdateOnboarding).toHaveBeenCalledTimes(1);
  });

  it('aborts the reset without calling updateOnboarding when the flow lookup fails', async () => {
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

  it('aborts without calling updateOnboarding when the onboarding flow has no first step', async () => {
    // steps: [] means state?.steps?.[0]?.key is undefined. Sending the PATCH
    // without onboarding_step leaves the server's user.onboarding_step at
    // "completed", which makes the very next response report completed: true
    // and silently undoes the reset client-side. The handler must refuse to
    // send a partial PATCH and tell the user instead.
    mockGetOnboarding.mockResolvedValue({ steps: [] });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String)));
    expect(mockUpdateOnboarding).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('surfaces an error when the PATCH resolves but the server reports the reset did not take', async () => {
    // completed: true means the server never actually flipped
    // has_completed_onboarding to false (e.g. onboarding_step never left
    // "completed"). Treating "the promise resolved" as success would leave
    // the user with no wizard and no explanation.
    mockUpdateOnboarding.mockResolvedValue({ completed: true });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));
    await pressConfirm();

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String)));
  });

  it('shows honest confirm copy: setup will be replayed and organisation details reconfirmed', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Reset Onboarding'));

    const [title, message] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Reset Onboarding');
    expect(message).toMatch(/confirm|re-enter/i);
    expect(message).toMatch(/organisation|organization/i);
    expect(message).not.toMatch(/not changed/i);
  });
});
