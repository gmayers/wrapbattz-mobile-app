import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FleetStatusScreen from '../FleetStatusScreen';
import type { FleetStatusData } from '../types';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock("../../../../notifications/queries", () => ({
  useUnreadCount: () => ({ count: 0 }),
}));


const baseData: FleetStatusData = {
  isLoading: false,
  organizationName: 'ACME',
  userInitials: 'AB',
  hasUnreadAlerts: false,
  inventory: {
    total: 10,
    available: 6,
    inUse: 2,
    maintenance: 1,
    missing: 1,
    tagsUsed: 8,
    tagsTotal: null,
    taggedPercent: 80,
  },
  exceptions: [
    {
      id: 'incident-1',
      kind: 'report',
      toolId: 5,
      incidentId: 42,
      toolName: 'Drill 5',
      ageLabel: '3d',
      detailLabel: 'Open report',
      severityColor: 'amber',
    },
    {
      id: 'exception-2',
      kind: 'overdue',
      toolId: 7,
      toolName: 'Saw 7',
      ageLabel: '1w',
      detailLabel: 'Overdue',
      severityColor: 'red',
    },
  ],
  exceptionsTotal: 2,
  refresh: jest.fn(),
};

let mockData: FleetStatusData = baseData;
jest.mock('../hooks/useFleetStatusData', () => ({
  useFleetStatusData: () => mockData,
}));

describe('FleetStatusScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockData = baseData;
  });

  it('navigates to ReportDetails with reportId when an exception has an incidentId', () => {
    const screen = render(<FleetStatusScreen />);
    fireEvent.press(screen.getByLabelText('Review Drill 5'));
    expect(mockNavigate).toHaveBeenCalledWith('ReportDetails', { reportId: 42 });
  });

  it('navigates to DeviceDetails with deviceId when an exception has only a toolId', () => {
    const screen = render(<FleetStatusScreen />);
    fireEvent.press(screen.getByLabelText('Chase Saw 7'));
    expect(mockNavigate).toHaveBeenCalledWith('DeviceDetails', { deviceId: 7 });
  });
});
