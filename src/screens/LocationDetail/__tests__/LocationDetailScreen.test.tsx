import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LocationDetailScreen from '../LocationDetailScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
  useRoute: () => ({ params: { id: 1, kind: 'site' } }),
}));

const baseHook = {
  isLoading: false,
  refresh: jest.fn(),
  kind: 'site' as const,
  name: 'Chelsea Wharf',
  code: 'CHW-04',
  users: [
    { memberId: 200, initials: 'WJ', name: 'Wendy Jones',     metaPrimary: 'Site lead', toolCount: 2 },
    { memberId: 201, initials: 'SW', name: 'Sylvia Williams', metaPrimary: 'Foreman',   toolCount: 1 },
  ],
  tools: [
    { toolId: 11, name: 'Drill', identifier: '#11', status: 'active' as const, assigneeName: 'Wendy Jones' },
  ],
};
const useLocationDetailMock = jest.fn(() => baseHook);

jest.mock('../hooks/useLocationDetail', () => ({
  useLocationDetail: (...args: any[]) => useLocationDetailMock(...args),
}));

beforeEach(() => {
  mockNavigate.mockClear();
  useLocationDetailMock.mockReturnValue(baseHook);
});

describe('LocationDetailScreen', () => {
  it('renders Users tab by default with member rows', () => {
    render(<LocationDetailScreen />);
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
    expect(screen.getByText('Sylvia Williams')).toBeTruthy();
  });

  it('switches to Tools tab on press', () => {
    render(<LocationDetailScreen />);
    fireEvent.press(screen.getByLabelText('Tools tab'));
    expect(screen.getByText('Drill')).toBeTruthy();
  });

  it('navigates to TeamMemberDetail on user press', () => {
    render(<LocationDetailScreen />);
    fireEvent.press(screen.getByLabelText('View Wendy Jones'));
    expect(mockNavigate).toHaveBeenCalledWith('TeamMemberDetail', { memberId: 200 });
  });

  it('navigates to DeviceDetails on tool press', () => {
    render(<LocationDetailScreen />);
    fireEvent.press(screen.getByLabelText('Tools tab'));
    fireEvent.press(screen.getByLabelText('Drill'));
    expect(mockNavigate).toHaveBeenCalledWith('DeviceDetails', { deviceId: 11 });
  });

  it('renders empty copy on Users tab when no users', () => {
    useLocationDetailMock.mockReturnValueOnce({ ...baseHook, users: [] });
    render(<LocationDetailScreen />);
    expect(screen.getByText('No one assigned tools here')).toBeTruthy();
  });

  it('renders empty copy on Tools tab when no tools', () => {
    useLocationDetailMock.mockReturnValue({ ...baseHook, tools: [] });
    render(<LocationDetailScreen />);
    fireEvent.press(screen.getByLabelText('Tools tab'));
    expect(screen.getByText('No tools here yet')).toBeTruthy();
  });
});
