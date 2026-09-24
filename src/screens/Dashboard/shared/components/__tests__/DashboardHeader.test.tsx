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
