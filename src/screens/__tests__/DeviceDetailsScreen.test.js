import React from 'react';
import { Alert } from 'react-native';
import { render, act, fireEvent, screen } from '@testing-library/react-native';
import { incidents as incidentsApi, sites as sitesApi, tools as toolsApi } from '../../api/endpoints';
import DeviceDetailsScreen from '../DeviceDetailsScreen';

jest.mock('../../api/endpoints', () => ({
  assignments: { listAssignments: jest.fn(), returnAssignment: jest.fn() },
  incidents: { listIncidents: jest.fn() },
  sites: { listSites: jest.fn(), listSitesForTool: jest.fn() },
  tools: {
    getTool: jest.fn(),
    getToolHistory: jest.fn(),
    assignToolToMe: jest.fn(),
    updateTool: jest.fn(),
    requestTool: jest.fn(),
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
    sitesApi.listSitesForTool.mockResolvedValue({ items: [] });
    mockAuth.isAdminOrOwner = false;
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  const renderScreen = async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };
    render(<DeviceDetailsScreen navigation={navigation} route={{ params: { deviceId: 42 } }} />);
    await act(async () => {});
  };

  it('requests only this tool\'s incidents (server-side filter)', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };
    render(
      <DeviceDetailsScreen navigation={navigation} route={{ params: { deviceId: 42 } }} />
    );
    await act(async () => {});

    expect(incidentsApi.listIncidents).toHaveBeenCalledWith({ tool: 42 });
  });

  it('shows the home location, or "Not set" for older tools', async () => {
    toolsApi.getTool.mockResolvedValue({ id: 42, name: 'Drill', home_site_id: 5, home_site_name: 'Leeds Yard' });
    await renderScreen();
    expect(screen.getByTestId('device-home-site').props.children).toBe('Leeds Yard');
    expect(screen.queryByTestId('device-set-home-site')).toBeNull(); // workers can't change it
  });

  it('lets an admin set the home location', async () => {
    mockAuth.isAdminOrOwner = true;
    toolsApi.getTool.mockResolvedValue({ id: 42, name: 'Drill', home_site_id: null, home_site_name: '' });
    sitesApi.listSitesForTool.mockResolvedValue({ items: [{ id: 5, name: 'Leeds Yard', site_type: 'warehouse', status: 'active' }] });
    toolsApi.updateTool.mockResolvedValue({ id: 42, name: 'Drill', home_site_id: 5, home_site_name: 'Leeds Yard' });
    await renderScreen();
    expect(screen.getByTestId('device-home-site').props.children).toBe('Not set');

    fireEvent.press(screen.getByTestId('device-set-home-site'));
    fireEvent.press(screen.getByText('Leeds Yard'));
    await act(async () => { fireEvent.press(screen.getByText('Confirm')); });

    expect(toolsApi.updateTool).toHaveBeenCalledWith(42, { home_site_id: 5 });
    expect(screen.getByTestId('device-home-site').props.children).toBe('Leeds Yard');
  });

  it('Request Device asks the holder to hand it over', async () => {
    toolsApi.getToolHistory.mockResolvedValue({
      items: [{ status: 'active', returned_at: null, assignee_user_id: 2, assignee_user_email: 'alex@example.com', assigned_at: '2026-09-01' }],
    });
    toolsApi.requestTool.mockResolvedValue({ id: 3, status: 'pending', from_user_email: 'alex@example.com' });
    await renderScreen();
    await act(async () => { fireEvent.press(screen.getByText('Request Device')); });

    expect(toolsApi.requestTool).toHaveBeenCalledWith(42, { message: '' });
    expect(Alert.alert).toHaveBeenCalledWith('Request sent', expect.stringContaining('alex@example.com will be asked to confirm'));
  });
});
