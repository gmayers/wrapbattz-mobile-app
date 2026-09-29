import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import TransferSettingsScreen, { toHHMM } from '../TransferSettingsScreen';
import * as organizationsApi from '../../../api/endpoints/organizations';
import { ApiError } from '../../../api/errors';

jest.mock('../../../api/endpoints/organizations');
jest.mock('../../../components/Dropdown', () => () => null);
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: { background: '#fff', surface: '#fff', textPrimary: '#000', textSecondary: '#666', primary: '#FFC72C', border: '#eee' } }),
}));

const org = { id: 1, name: 'Acme', require_transfer_confirmation: true, timezone: 'Europe/London', workday_end_time: '18:00:00' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (organizationsApi.getMyOrganization as jest.Mock).mockResolvedValue(org);
});

it('toggling confirmation saves it', async () => {
  (organizationsApi.updateMyOrganization as jest.Mock).mockResolvedValue({ ...org, require_transfer_confirmation: false });
  render(<TransferSettingsScreen />);
  const toggle = await screen.findByLabelText('Recipient must accept transfers');
  await act(async () => {
    fireEvent(toggle, 'valueChange', false);
  });
  expect(organizationsApi.updateMyOrganization).toHaveBeenCalledWith({ require_transfer_confirmation: false });
  // Expiry settings only matter while confirmation is on.
  expect(screen.queryByText('Unanswered transfers expire')).toBeNull();
});

it('rolls back and explains when the save fails', async () => {
  (organizationsApi.updateMyOrganization as jest.Mock).mockRejectedValue(
    new ApiError({ code: 'forbidden', status: 403, message: 'Only owners and admins can change this.' })
  );
  render(<TransferSettingsScreen />);
  const toggle = await screen.findByLabelText('Recipient must accept transfers');
  await act(async () => {
    fireEvent(toggle, 'valueChange', false);
  });
  expect(Alert.alert).toHaveBeenCalledWith('Could not save', 'Only owners and admins can change this.');
  expect(screen.getByLabelText('Recipient must accept transfers').props.value).toBe(true);
});

it('toHHMM normalises backend times', () => {
  expect(toHHMM('18:00:00')).toBe('18:00');
  expect(toHHMM('7:30')).toBe('07:30');
  expect(toHHMM(null)).toBe('18:00');
});
