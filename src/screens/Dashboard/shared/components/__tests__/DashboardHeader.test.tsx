import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DashboardHeader from '../DashboardHeader';

function renderHeader(hasUnreadAlerts: boolean | null, onAlertsPress = jest.fn()) {
  render(
    <DashboardHeader
      tagline="Acme"
      title="Control room"
      subtitle="Today"
      initials="AB"
      hasUnreadAlerts={hasUnreadAlerts}
      onAlertsPress={onAlertsPress}
      onAvatarPress={jest.fn()}
    />
  );
  return onAlertsPress;
}

describe('DashboardHeader bell', () => {
  // The bell always has a destination now (the Notifications inbox), so it is
  // always rendered; onAlertsPress is a required prop.
  it('renders the bell and calls the handler once when pressed', () => {
    const onPress = renderHeader(false);
    const bell = screen.getByLabelText('View alerts');
    expect(bell.props.accessibilityRole).toBe('button');
    fireEvent.press(bell);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('announces unread alerts to screen readers', () => {
    const onPress = renderHeader(true);
    fireEvent.press(screen.getByLabelText('View alerts, unread'));
    expect(onPress).toHaveBeenCalled();
  });

  it('uses the plain label when nothing is unread', () => {
    renderHeader(false);
    expect(screen.getByLabelText('View alerts')).toBeTruthy();
    expect(screen.queryByLabelText('View alerts, unread')).toBeNull();
  });
});
