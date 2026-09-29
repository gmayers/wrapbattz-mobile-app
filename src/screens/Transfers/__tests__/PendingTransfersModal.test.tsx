import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PendingTransfersModal, { __resetDismissedTransfersForTests } from '../PendingTransfersModal';
import * as transfersApi from '../../../api/endpoints/transfers';
import { ApiError } from '../../../api/errors';
import { queryClient } from '../../../query/queryClient';

jest.mock('../../../api/endpoints/transfers');
jest.mock('../../../query/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
// Run the focus effect once on mount, like a first dashboard focus.
jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void) => R.useEffect(cb, []) };
});
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: { surface: '#fff', textPrimary: '#000', textSecondary: '#666', primary: '#FFC72C', border: '#eee' } }),
}));

const t = (id: number, tool_name = `Tool ${id}`) => ({
  id, uuid: `u${id}`, tool_id: id, tool_name, from_user_id: 1, from_user_email: 'alex@example.com',
  to_user_id: 2, to_user_email: 'me@example.com', status: 'pending', note: '',
  expires_at: '2026-09-29T17:00:00Z', decided_at: null, created_by_id: 1,
});

beforeEach(() => {
  jest.clearAllMocks();
  __resetDismissedTransfersForTests();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

it('shows one card per pending transfer', async () => {
  (transfersApi.listPendingForMe as jest.Mock).mockResolvedValue([t(1, 'Drill'), t(2, 'Saw')]);
  render(<PendingTransfersModal />);
  expect(await screen.findByTestId('pending-transfer-1')).toBeTruthy();
  expect(screen.getByTestId('pending-transfer-2')).toBeTruthy();
  expect(screen.getAllByText('From alex@example.com')).toHaveLength(2);
});

it('renders nothing when there are no pending transfers', async () => {
  (transfersApi.listPendingForMe as jest.Mock).mockResolvedValue([]);
  render(<PendingTransfersModal />);
  await waitFor(() => expect(transfersApi.listPendingForMe).toHaveBeenCalled());
  expect(screen.queryByTestId('pending-transfers-modal')).toBeNull();
});

it('accept calls through, removes the card and refreshes queries', async () => {
  (transfersApi.listPendingForMe as jest.Mock).mockResolvedValue([t(1, 'Drill'), t(2)]);
  (transfersApi.acceptTransfer as jest.Mock).mockResolvedValue({ ...t(1), status: 'accepted' });
  render(<PendingTransfersModal />);
  const accept = await screen.findByLabelText('Accept Drill');
  await act(async () => {
    fireEvent.press(accept);
  });
  expect(screen.queryByTestId('pending-transfer-1')).toBeNull();
  expect(transfersApi.acceptTransfer).toHaveBeenCalledWith(1);
  expect(queryClient.invalidateQueries).toHaveBeenCalled();
  expect(screen.getByTestId('pending-transfer-2')).toBeTruthy();
});

it('decline calls through and closes when nothing is left', async () => {
  (transfersApi.listPendingForMe as jest.Mock).mockResolvedValue([t(1, 'Drill')]);
  (transfersApi.declineTransfer as jest.Mock).mockResolvedValue({ ...t(1), status: 'declined' });
  render(<PendingTransfersModal />);
  const decline = await screen.findByLabelText('Decline Drill');
  await act(async () => {
    fireEvent.press(decline);
  });
  expect(screen.queryByTestId('pending-transfers-modal')).toBeNull();
  expect(transfersApi.declineTransfer).toHaveBeenCalledWith(1);
});

it('a conflict (expired / custody changed) alerts and reloads the list', async () => {
  (transfersApi.listPendingForMe as jest.Mock).mockResolvedValueOnce([t(1, 'Drill')]).mockResolvedValueOnce([]);
  (transfersApi.acceptTransfer as jest.Mock).mockRejectedValue(
    new ApiError({ code: 'conflict', status: 409, message: 'This transfer has expired.' })
  );
  render(<PendingTransfersModal />);
  fireEvent.press(await screen.findByLabelText('Accept Drill'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Could not accept', 'This transfer has expired.'));
  await waitFor(() => expect(transfersApi.listPendingForMe).toHaveBeenCalledTimes(2));
});

it('closing hides the transfers for the rest of this app session', async () => {
  (transfersApi.listPendingForMe as jest.Mock).mockResolvedValue([t(1)]);
  const first = render(<PendingTransfersModal />);
  fireEvent.press(await screen.findByLabelText('Close pending transfers'));
  expect(screen.queryByTestId('pending-transfers-modal')).toBeNull();
  first.unmount();

  render(<PendingTransfersModal />);
  await act(async () => {});
  expect(screen.queryByTestId('pending-transfers-modal')).toBeNull();
});

it('shows a claim to the holder as a hand-over request', async () => {
  (transfersApi.listPendingForMe as jest.Mock).mockResolvedValue([
    { ...t(4, 'Drill'), kind: 'claim', from_user_email: 'me@example.com', to_user_email: 'sam@example.com', awaiting_user_id: 2 },
  ]);
  (transfersApi.acceptTransfer as jest.Mock).mockResolvedValue({ status: 'accepted' });
  render(<PendingTransfersModal />);
  expect(await screen.findByText('sam@example.com wants to take this tool')).toBeTruthy();
  expect(screen.getByText('Someone is asking for your tool')).toBeTruthy();
  expect(screen.getByText('Keep it')).toBeTruthy();

  const handOver = screen.getByLabelText('Accept Drill');
  await act(async () => {
    fireEvent.press(handOver);
  });
  expect(transfersApi.acceptTransfer).toHaveBeenCalledWith(4);
  expect(Alert.alert).toHaveBeenCalledWith('Handed over', 'Drill is now assigned to sam@example.com.');
});
