import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FleetStatusScreen from '../FleetStatusScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: () => {},
}));

jest.mock('../hooks/useFleetStatusData', () => ({
  useFleetStatusData: () => ({
    isLoading: false,
    organizationName: 'Acme',
    userInitials: 'AB',
    hasUnreadAlerts: false,
    inventory: {
      total: 2, available: 1, inUse: 1, maintenance: 0, missing: null,
      tagsUsed: 0, tagsTotal: null, taggedPercent: null,
    },
    exceptions: [
      { id: 'o1', kind: 'overdue', toolId: 11, toolName: 'Drill', ageLabel: '2d', detailLabel: '', severityColor: 'red' },
      { id: 'r1', kind: 'report', toolId: 12, incidentId: 99, toolName: 'Saw', ageLabel: '1d', detailLabel: '', severityColor: 'amber' },
    ],
    exceptionsTotal: 2,
    refresh: jest.fn(),
  }),
}));

describe('FleetStatusScreen exception actions', () => {
  beforeEach(() => mockNavigate.mockClear());

  // DeviceDetails reads route.params.deviceId and ReportDetails reads
  // route.params.reportId — passing `{ id }` opened both screens empty.
  it('opens the device with the deviceId param the details screen reads', () => {
    const { getByLabelText } = render(<FleetStatusScreen />);
    fireEvent.press(getByLabelText('Chase Drill'));
    expect(mockNavigate).toHaveBeenCalledWith('DeviceDetails', { deviceId: 11 });
  });

  it('opens the report with the reportId param the report screen reads', () => {
    const { getByLabelText } = render(<FleetStatusScreen />);
    fireEvent.press(getByLabelText('Review Saw'));
    expect(mockNavigate).toHaveBeenCalledWith('ReportDetails', { reportId: 99 });
  });
});
