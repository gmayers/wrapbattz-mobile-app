import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import CreateReportScreen from '../CreateReportScreen';
import { assignments, tools } from '../../api/endpoints';

jest.mock('../../api/endpoints', () => ({
  assignments: { listMyActiveAssignments: jest.fn() },
  incidents: { createIncident: jest.fn() },
  toolPhotos: {},
  tools: { getTool: jest.fn() },
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-signature-canvas', () => () => null);
jest.mock('react-native-fs', () => ({ DocumentDirectoryPath: '/docs', copyFile: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ userData: {}, isLoading: false }) }));
jest.mock('../../query/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));

const mockDropdownProps = [];
jest.mock('../../components/Dropdown', () => (props) => {
  mockDropdownProps.push(props);
  return null;
});

const assignment = (toolId, name) => ({
  id: toolId * 10, tool_id: toolId, tool_name: name, status: 'active', returned_at: null,
  assignee_user_id: 1, assigned_at: '2026-09-01T00:00:00Z',
});

const lastDeviceDropdown = () => mockDropdownProps.filter((p) => p.placeholder === 'Select a device').pop();

beforeEach(() => {
  jest.clearAllMocks();
  mockDropdownProps.length = 0;
  assignments.listMyActiveAssignments.mockResolvedValue([assignment(1, 'My Drill'), assignment(2, 'My Saw')]);
});

it('preselects the scanned tool when it is one of mine', async () => {
  render(<CreateReportScreen navigation={{}} route={{ params: { deviceId: 2 } }} />);
  await waitFor(() => expect(lastDeviceDropdown()?.value).toBe(2));
  expect(tools.getTool).not.toHaveBeenCalled();
});

it('adds and preselects a scanned tool that is not assigned to me', async () => {
  tools.getTool.mockResolvedValue({ id: 7, name: 'Site Grinder', category_name: 'Tool' });
  render(<CreateReportScreen navigation={{}} route={{ params: { deviceId: 7, identifier: 'Grinder' } }} />);
  await waitFor(() => expect(lastDeviceDropdown()?.value).toBe(7));
  expect(lastDeviceDropdown().items[0]).toEqual({ label: 'Site Grinder - Tool', value: 7 });
  expect(tools.getTool).toHaveBeenCalledWith(7);
});

it('falls back to the passed name if the tool lookup fails', async () => {
  tools.getTool.mockRejectedValue(new Error('offline'));
  render(<CreateReportScreen navigation={{}} route={{ params: { deviceId: 7, identifier: 'Grinder' } }} />);
  await waitFor(() => expect(lastDeviceDropdown()?.value).toBe(7));
  expect(lastDeviceDropdown().items[0]).toEqual({ label: 'Grinder', value: 7 });
});

it('defaults to my first tool when opened without a device', async () => {
  render(<CreateReportScreen navigation={{}} route={{}} />);
  await waitFor(() => expect(lastDeviceDropdown()?.value).toBe(1));
});
