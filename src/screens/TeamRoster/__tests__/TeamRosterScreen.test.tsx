import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TeamRosterScreen from '../TeamRosterScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
}));

jest.mock('../../Dashboard/OfficeWorker/hooks/useOfficeWorkerTeamData', () => ({
  useOfficeWorkerTeamData: () => ({
    isLoading: false,
    refresh: jest.fn(),
    organizationName: 'TESTORG',
    userInitials: 'XY',
    hasUnreadAlerts: null,
    totalMembers: 1,
    totalToolsOut: 3,
    onSite: null,
    hq: null,
    members: [
      { memberId: 200, initials: 'WJ', name: 'Wendy Jones', metaPrimary: 'Site lead', toolCount: 3 },
    ],
  }),
}));

beforeEach(() => mockNavigate.mockClear());

describe('TeamRosterScreen', () => {
  it('renders the roster content', () => {
    render(<TeamRosterScreen />);
    expect(screen.getByText('Team roster')).toBeTruthy();
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
  });

  it('does NOT render the Where/Team segmented control', () => {
    render(<TeamRosterScreen />);
    expect(screen.queryByLabelText('Where tab')).toBeNull();
    expect(screen.queryByLabelText('Team tab')).toBeNull();
  });

  it('navigates to TeamMemberDetail on member press', () => {
    render(<TeamRosterScreen />);
    fireEvent.press(screen.getByLabelText('View Wendy Jones'));
    expect(mockNavigate).toHaveBeenCalledWith('TeamMemberDetail', { memberId: 200 });
  });
});
