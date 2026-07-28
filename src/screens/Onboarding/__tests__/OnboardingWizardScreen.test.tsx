import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';
import { account } from '../../../api/endpoints';
import OnboardingWizardScreen from '../OnboardingWizardScreen';

jest.mock('../../../api/endpoints', () => ({
  account: { getOnboarding: jest.fn() },
}));

const mockUpdateOnboarding = jest.fn();
const mockRefreshUser = jest.fn();
const mockAuth = {
  updateOnboarding: mockUpdateOnboarding,
  refreshUser: mockRefreshUser,
  logout: jest.fn(),
};
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockTheme = { colors: new Proxy({}, { get: () => '#000000' }) };
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('../steps', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  const Step = ({ advance, state }: any) =>
    React.createElement(
      TouchableOpacity,
      { testID: 'advance', onPress: advance },
      React.createElement(Text, null, `on:${state.current_step}`),
    );
  return { STEP_COMPONENTS: { stepA: Step, stepB: Step } };
});

const STATE = {
  flow: 'owner',
  current_step: 'stepA',
  steps: [
    { key: 'stepA', label: 'Step A' },
    { key: 'stepB', label: 'Step B' },
  ],
};

describe('OnboardingWizardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateOnboarding.mockResolvedValue({ ...STATE, current_step: 'stepB' });
  });

  it('advances using the PATCH response, with no follow-up GET', async () => {
    (account.getOnboarding as jest.Mock).mockResolvedValue(STATE);

    const screen = render(<OnboardingWizardScreen />);
    await act(async () => {});
    expect(screen.getByText('on:stepA')).toBeTruthy();

    fireEvent.press(screen.getByTestId('advance'));
    await act(async () => {});

    expect(mockUpdateOnboarding).toHaveBeenCalledWith({ onboarding_step: 'stepB' });
    expect(screen.getByText('on:stepB')).toBeTruthy();
    // PATCH /account/onboarding/ returns OnboardingState — one GET at mount only.
    expect(account.getOnboarding).toHaveBeenCalledTimes(1);
  });

  it('completes without an extra account refetch (PATCH response already applied)', async () => {
    (account.getOnboarding as jest.Mock).mockResolvedValue({
      ...STATE,
      current_step: 'stepB',
    });

    const screen = render(<OnboardingWizardScreen />);
    await act(async () => {});

    fireEvent.press(screen.getByTestId('advance'));
    await act(async () => {});

    expect(mockUpdateOnboarding).toHaveBeenCalledWith({
      has_completed_onboarding: true,
      onboarding_step: 'completed',
    });
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });
});
