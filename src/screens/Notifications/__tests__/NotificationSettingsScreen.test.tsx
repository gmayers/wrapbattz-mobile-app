import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NotificationSettingsScreen from '../NotificationSettingsScreen';
import * as q from '../../../notifications/queries';
import { ApiError } from '../../../api/errors';

jest.mock('../../../notifications/queries');
let mockOfficer = false;
jest.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ isAdminOrOwner: mockOfficer }) }));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: { background: '#fff', card: '#fff', textPrimary: '#000', textSecondary: '#666', primary: '#FFC72C', border: '#eee', disabled: '#ccc' } }),
}));

const prefs = {
  master: { push: true, email: true },
  types: [
    { type: 'transfer_requested', label: 'Transfer Requested', description: '', urgent: false, locked: false,
      push: { enabled: true, editable: true }, email: { enabled: true, editable: false } },
    { type: 'maintenance_due', label: 'Maintenance Due', description: '', urgent: false, locked: true,
      push: { enabled: true, editable: false }, email: { enabled: true, editable: false } },
    { type: 'transfer_accepted', label: 'Transfer Accepted', description: '', urgent: false, locked: false,
      push: { enabled: true, editable: false }, email: { enabled: false, editable: false } },
  ],
};
const savePrefs = jest.fn();
const savePolicy = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockOfficer = false;
  (q.useNotificationPreferences as jest.Mock).mockReturnValue({ data: prefs, isLoading: false, isError: false });
  (q.useUpdateNotificationPreferences as jest.Mock).mockReturnValue({ mutate: savePrefs, isPending: false });
  (q.useNotificationPolicy as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
  (q.useUpdateNotificationPolicy as jest.Mock).mockReturnValue({ mutate: savePolicy, isPending: false });
});

it('toggling an editable switch saves the whole payload', () => {
  render(<NotificationSettingsScreen />);
  fireEvent(screen.getByLabelText('Transfer Requested push'), 'valueChange', false);
  expect(savePrefs.mock.calls[0][0]).toEqual(expect.objectContaining({
    types: expect.arrayContaining([
      expect.objectContaining({ type: 'transfer_requested', push: { enabled: false, editable: true } }),
    ]),
  }));
});

it('disabled rows cannot be toggled and explain why', () => {
  render(<NotificationSettingsScreen />);
  expect(screen.getByLabelText('Transfer Requested email').props.disabled).toBe(true);
  expect(screen.getByText('Required')).toBeTruthy();
  expect(screen.getByText('Managed by your organisation')).toBeTruthy();
});

it('workers do not see organisation defaults', () => {
  render(<NotificationSettingsScreen />);
  expect(screen.queryByText('Organisation defaults')).toBeNull();
  expect(q.useNotificationPolicy).toHaveBeenCalledWith(false);
});

it('officers can change the digest interval', () => {
  mockOfficer = true;
  (q.useNotificationPolicy as jest.Mock).mockReturnValue({
    data: { digest_minutes: 60, members_can_disable_push: true, members_can_disable_email: true, types: [] },
    isLoading: false,
  });
  render(<NotificationSettingsScreen />);
  fireEvent.press(screen.getByLabelText('Digest every 30 minutes'));
  expect(savePolicy.mock.calls[0][0]).toEqual(expect.objectContaining({ digest_minutes: 30 }));
});

it('does not call mutate when toggling a non-editable switch', () => {
  render(<NotificationSettingsScreen />);
  fireEvent(screen.getByLabelText('Transfer Requested email'), 'valueChange', false);
  expect(savePrefs).not.toHaveBeenCalled();
});

it('shows an alert when saving a preference fails', () => {
  render(<NotificationSettingsScreen />);
  fireEvent(screen.getByLabelText('Transfer Requested push'), 'valueChange', false);
  const onError = savePrefs.mock.calls[0][1].onError;
  onError(new Error('network down'));
  expect(Alert.alert).toHaveBeenCalledWith("Couldn't save", "Couldn't save your changes. Please try again.");
});

it('tells the user their organisation manages a setting the server rejected', () => {
  render(<NotificationSettingsScreen />);
  fireEvent(screen.getByLabelText('Transfer Requested push'), 'valueChange', false);
  const onError = savePrefs.mock.calls[0][1].onError;
  onError(new ApiError({
    code: 'forbidden',
    status: 403,
    message: 'Forbidden',
    detail: { code: 'preference_not_editable' },
  }));
  expect(Alert.alert).toHaveBeenCalledWith("Couldn't save", 'Your organisation manages this setting.');
});

it('shows an alert when saving the organisation policy fails', () => {
  mockOfficer = true;
  (q.useNotificationPolicy as jest.Mock).mockReturnValue({
    data: { digest_minutes: 60, members_can_disable_push: true, members_can_disable_email: true, types: [] },
    isLoading: false,
  });
  render(<NotificationSettingsScreen />);
  fireEvent.press(screen.getByLabelText('Digest every 30 minutes'));
  const onError = savePolicy.mock.calls[0][1].onError;
  onError(new Error('server error'));
  expect(Alert.alert).toHaveBeenCalledWith("Couldn't save", "Couldn't save your changes. Please try again.");
});

it('disables the personal preference switches while a save is pending', () => {
  (q.useUpdateNotificationPreferences as jest.Mock).mockReturnValue({ mutate: savePrefs, isPending: true });
  render(<NotificationSettingsScreen />);
  expect(screen.getByLabelText('All push notifications').props.disabled).toBe(true);
  expect(screen.getByLabelText('All email notifications').props.disabled).toBe(true);
  expect(screen.getByLabelText('Transfer Requested push').props.disabled).toBe(true);
});

it('disables the organisation defaults controls while a policy save is pending', () => {
  mockOfficer = true;
  (q.useNotificationPolicy as jest.Mock).mockReturnValue({
    data: { digest_minutes: 60, members_can_disable_push: true, members_can_disable_email: true, types: [] },
    isLoading: false,
  });
  (q.useUpdateNotificationPolicy as jest.Mock).mockReturnValue({ mutate: savePolicy, isPending: true });
  render(<NotificationSettingsScreen />);
  expect(screen.getByLabelText('Digest every 30 minutes').props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Members can turn off push').props.disabled).toBe(true);
});

it('offers a retry when preferences fail to load', () => {
  const refetch = jest.fn();
  (q.useNotificationPreferences as jest.Mock).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
  render(<NotificationSettingsScreen />);
  expect(screen.getByText("Couldn't load notification settings")).toBeTruthy();
  fireEvent.press(screen.getByText('Try again'));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('tells officers when organisation defaults fail to load, with retry', () => {
  mockOfficer = true;
  const refetch = jest.fn();
  (q.useNotificationPolicy as jest.Mock).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
  render(<NotificationSettingsScreen />);
  expect(screen.getByText("Couldn't load organisation defaults")).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Retry loading organisation defaults'));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('workers never see the organisation defaults error', () => {
  (q.useNotificationPolicy as jest.Mock).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: jest.fn() });
  render(<NotificationSettingsScreen />);
  expect(screen.queryByText("Couldn't load organisation defaults")).toBeNull();
});
