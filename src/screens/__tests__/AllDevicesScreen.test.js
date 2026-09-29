import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AllDevicesScreen from '../AllDevicesScreen';
import { assignments, sites } from '../../api/endpoints';

jest.mock('../../api/endpoints', () => ({
  assignments: {
    listMyActiveAssignments: jest.fn(),
    listAssignments: jest.fn(),
    returnAssignment: jest.fn(),
  },
  sites: { listSitesForTool: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
let mockOfficer = false;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { userId: 1 }, isAdminOrOwner: mockOfficer }),
}));
jest.mock('../../components/StandardDeviceCard', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return ({ assignment, onReturn }) => (
    <TouchableOpacity testID={`return-${assignment.id}`} onPress={() => onReturn(assignment)}>
      <Text>{assignment.device.identifier}</Text>
    </TouchableOpacity>
  );
});

const HOME = { id: 5, name: 'Leeds Yard', site_type: 'warehouse', is_home: true };
const OTHER = { id: 6, name: 'Van 2', site_type: 'vehicle', is_home: false };

beforeEach(() => {
  jest.clearAllMocks();
  mockOfficer = false;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  assignments.listMyActiveAssignments.mockResolvedValue([
    { id: 9, tool_id: 42, tool_name: 'DRILL-1', status: 'active', returned_at: null, assignee_user_id: 1, assigned_at: '2026-09-01' },
  ]);
  assignments.listAssignments.mockResolvedValue({ items: [], total_pages: 1 });
  assignments.returnAssignment.mockResolvedValue({});
  sites.listSitesForTool.mockResolvedValue({ items: [HOME, OTHER] });
});

const openReturn = async () => {
  render(<AllDevicesScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} route={{}} />);
  const card = await screen.findByTestId('return-9');
  await act(async () => { fireEvent.press(card); });
};

it('a worker can only return to the home site, which is pre-selected', async () => {
  await openReturn();
  expect(sites.listSitesForTool).toHaveBeenCalledWith(42);
  expect(screen.getByText('🏠 Leeds Yard (home)', { exact: false })).toBeTruthy();
  expect(screen.queryByText('Van 2', { exact: false })).toBeNull();

  await act(async () => { fireEvent.press(screen.getByText('Confirm Return')); });
  expect(assignments.returnAssignment).toHaveBeenCalledWith(9, { target_site_id: 5, condition: '', notes: '' });
});

it('an admin sees every site and can pick another', async () => {
  mockOfficer = true;
  await openReturn();
  await act(async () => { fireEvent.press(screen.getByText('Van 2', { exact: false })); });
  await act(async () => { fireEvent.press(screen.getByText('Confirm Return')); });
  expect(assignments.returnAssignment).toHaveBeenCalledWith(9, { target_site_id: 6, condition: '', notes: '' });
});

it('a tool with no home site returns without a target', async () => {
  sites.listSitesForTool.mockResolvedValue({ items: [{ ...OTHER }] });
  await openReturn();
  expect(screen.getByTestId('return-no-home')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText('Confirm Return')); });
  expect(assignments.returnAssignment).toHaveBeenCalledWith(9, { target_site_id: null, condition: '', notes: '' });
});
