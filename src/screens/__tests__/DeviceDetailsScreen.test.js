import React from 'react';
import { render, act } from '@testing-library/react-native';
import { incidents as incidentsApi, tools as toolsApi } from '../../api/endpoints';
import DeviceDetailsScreen from '../DeviceDetailsScreen';

jest.mock('../../api/endpoints', () => ({
  assignments: { listAssignments: jest.fn(), returnAssignment: jest.fn() },
  incidents: { listIncidents: jest.fn() },
  sites: { listSites: jest.fn(), listSitesForTool: jest.fn() },
  tools: {
    getTool: jest.fn(),
    getToolHistory: jest.fn(),
    assignToolToMe: jest.fn(),
  },
}));

const mockAuth = {
  isAdminOrOwner: false,
  userData: { role: 'site_worker' },
  user: { id: 1, email: 'w@example.com' },
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

describe('DeviceDetailsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toolsApi.getTool.mockResolvedValue({ id: 42, name: 'Drill', status: 'no_status' });
    toolsApi.getToolHistory.mockResolvedValue({ items: [] });
    incidentsApi.listIncidents.mockResolvedValue({ items: [] });
  });

  it('requests only this tool\'s incidents (server-side filter)', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };
    render(
      <DeviceDetailsScreen navigation={navigation} route={{ params: { deviceId: 42 } }} />
    );
    await act(async () => {});

    expect(incidentsApi.listIncidents).toHaveBeenCalledWith({ tool: 42 });
  });
});
