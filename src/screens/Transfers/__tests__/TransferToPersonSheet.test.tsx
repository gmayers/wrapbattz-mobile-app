import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TransferToPersonSheet, { memberName } from '../TransferToPersonSheet';
import * as membersApi from '../../../api/endpoints/members';
import * as transfersApi from '../../../api/endpoints/transfers';
import { ApiError } from '../../../api/errors';

jest.mock('../../../api/endpoints/members');
jest.mock('../../../api/endpoints/transfers');
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: { surface: '#fff', textPrimary: '#000', textSecondary: '#666', primary: '#FFC72C', border: '#eee', error: 'red' } }),
}));

const m = (user_id: number, first_name: string, is_active = true) => ({
  id: user_id, user_id, email: `${first_name.toLowerCase()}@example.com`, first_name, last_name: '',
  role: 'site_worker', is_active, is_primary: false, joined_at: '2026-01-01T00:00:00Z',
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (membersApi.listMembers as jest.Mock).mockResolvedValue({
    items: [m(1, 'Holder'), m(2, 'Bea'), m(3, 'Gone', false)],
  });
});

const renderSheet = (onDone = jest.fn()) =>
  render(
    <TransferToPersonSheet visible toolId={9} toolName="Drill" holderUserId={1} onClose={jest.fn()} onDone={onDone} />
  );

it('lists active members except the current holder', async () => {
  renderSheet();
  expect(await screen.findByLabelText('Transfer to Bea')).toBeTruthy();
  expect(screen.queryByLabelText('Transfer to Holder')).toBeNull();
  expect(screen.queryByLabelText('Transfer to Gone')).toBeNull();
});

it('creates the transfer for the picked member with the note', async () => {
  const onDone = jest.fn();
  const transfer = { id: 5, status: 'pending' };
  (transfersApi.createTransfer as jest.Mock).mockResolvedValue(transfer);
  renderSheet(onDone);
  fireEvent.press(await screen.findByLabelText('Transfer to Bea'));
  fireEvent.changeText(screen.getByLabelText('Transfer note'), ' at the van ');
  fireEvent.press(screen.getByTestId('transfer-person-send'));
  await waitFor(() => expect(onDone).toHaveBeenCalledWith(transfer, expect.objectContaining({ user_id: 2 })));
  expect(transfersApi.createTransfer).toHaveBeenCalledWith({ tool_id: 9, to_user_id: 2, note: 'at the van' });
});

it('shows the backend message when the tool already has a pending transfer', async () => {
  (transfersApi.createTransfer as jest.Mock).mockRejectedValue(
    new ApiError({ code: 'conflict', status: 409, message: 'This tool already has a pending transfer to Sam.' })
  );
  renderSheet();
  fireEvent.press(await screen.findByLabelText('Transfer to Bea'));
  fireEvent.press(screen.getByTestId('transfer-person-send'));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith('Transfer failed', 'This tool already has a pending transfer to Sam.')
  );
});

it('memberName prefers the full name and falls back to email', () => {
  expect(memberName({ first_name: 'Bea', last_name: 'Li', email: 'b@x.com' })).toBe('Bea Li');
  expect(memberName({ first_name: '', last_name: '', email: 'b@x.com' })).toBe('b@x.com');
});
