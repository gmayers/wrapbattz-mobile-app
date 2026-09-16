import React from 'react';
import { render, act } from '@testing-library/react-native';
import { incidents as incidentsApi } from '../../api/endpoints';
import AllReportsScreen from '../AllReportsScreen';

jest.mock('../../api/endpoints', () => ({
  incidents: {
    listIncidents: jest.fn(),
    listMyIncidents: jest.fn(),
    updateIncident: jest.fn(),
  },
}));

const mockAuth = {
  userData: { role: 'owner' },
  user: { id: 7, email: 'owner@example.com' },
  isAdminOrOwner: true,
};
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockTheme = { colors: new Proxy({}, { get: () => '#000000' }) };
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

function makeNavigation() {
  return {
    setOptions: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => () => {}),
  };
}

const incident = (id, reportedBy) => ({
  id,
  uuid: `u-${id}`,
  type: 'DAMAGED',
  severity: 'low',
  status: 'pending',
  description: `incident ${id}`,
  tool_id: 1,
  tool_name: 'Drill',
  site_id: null,
  site_name: null,
  reported_by_id: reportedBy,
  reported_by_email: 'x@example.com',
  created_at: '2026-07-01T00:00:00Z',
});

describe('AllReportsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('admin loads the org list once and derives My Reports from it', async () => {
    incidentsApi.listIncidents.mockResolvedValue({
      items: [incident(1, 7), incident(2, 8)],
    });
    const screen = render(
      <AllReportsScreen navigation={makeNavigation()} route={{ params: {} }} />
    );
    await act(async () => {});

    expect(incidentsApi.listIncidents).toHaveBeenCalledTimes(1);
    // "Mine" comes from filtering the org list — no second request.
    expect(incidentsApi.listMyIncidents).not.toHaveBeenCalled();
    // Default tab is "my": only the admin's own incident is shown.
    expect(screen.getByText(/incident 1/)).toBeTruthy();
    expect(screen.queryByText(/incident 2/)).toBeNull();
  });
});
