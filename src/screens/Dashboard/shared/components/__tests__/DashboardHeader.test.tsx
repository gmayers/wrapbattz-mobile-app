import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import DashboardHeader from '../DashboardHeader';

const baseProps = {
  tagline: 'YOUR ORGANIZATION',
  title: 'Dashboard',
  subtitle: '0 devices',
  initials: 'AB',
  hasUnreadAlerts: false,
  onAvatarPress: jest.fn(),
};

describe('DashboardHeader alerts bell', () => {
  // Neither dashboard screen has anywhere for the bell to go
  // (NotificationPreferences was removed) — a tappable icon that does
  // nothing on press is a dead affordance, so it must not render at all
  // when no handler is supplied.
  it('does not render the bell when onAlertsPress is not provided', () => {
    render(<DashboardHeader {...baseProps} />);
    expect(screen.queryByLabelText('View alerts')).toBeNull();
  });

  it('renders the bell and calls the handler when onAlertsPress is provided', () => {
    const onAlertsPress = jest.fn();
    render(<DashboardHeader {...baseProps} onAlertsPress={onAlertsPress} />);

    const bell = screen.getByLabelText('View alerts');
    expect(bell).toBeTruthy();

    fireEvent.press(bell);
    expect(onAlertsPress).toHaveBeenCalledTimes(1);
  });
});
