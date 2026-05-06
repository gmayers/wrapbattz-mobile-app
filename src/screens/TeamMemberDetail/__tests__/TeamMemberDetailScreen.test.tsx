import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TeamMemberDetailScreen from '../TeamMemberDetailScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
  useRoute: () => ({ params: { memberId: 200 } }),
}));

const hookResult = {
  isLoading: false,
  refresh: jest.fn(),
  initials: 'WJ',
  name: 'Wendy Jones',
  email: 'wj@x.com',
  role: 'Site worker',
  tools: [
    { toolId: 11, name: 'Drill', identifier: '#11', status: 'active' as const },
    { toolId: 12, name: 'Saw',   identifier: '#12', status: 'active' as const },
  ],
};

jest.mock('../hooks/useTeamMemberDetail', () => ({
  useTeamMemberDetail: () => hookResult,
}));

beforeEach(() => mockNavigate.mockClear());

describe('TeamMemberDetailScreen', () => {
  it('renders profile header and tools list', () => {
    render(<TeamMemberDetailScreen />);
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
    expect(screen.getByText('Site worker')).toBeTruthy();
    expect(screen.getByText('Drill')).toBeTruthy();
    expect(screen.getByText('Saw')).toBeTruthy();
  });

  it('navigates to DeviceDetails on tool press', () => {
    render(<TeamMemberDetailScreen />);
    fireEvent.press(screen.getByLabelText('Drill'));
    expect(mockNavigate).toHaveBeenCalledWith('DeviceDetails', { deviceId: 11 });
  });
});
