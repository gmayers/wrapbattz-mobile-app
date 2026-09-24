import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NotificationSettingsScreen from '../NotificationSettingsScreen';
import * as q from '../../../notifications/queries';

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
  mockOfficer = false;
  (q.useNotificationPreferences as jest.Mock).mockReturnValue({ data: prefs, isLoading: false, isError: false });
  (q.useUpdateNotificationPreferences as jest.Mock).mockReturnValue({ mutate: savePrefs, isPending: false });
  (q.useNotificationPolicy as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
  (q.useUpdateNotificationPolicy as jest.Mock).mockReturnValue({ mutate: savePolicy, isPending: false });
});

it('toggling an editable switch saves the whole payload', () => {
  render(<NotificationSettingsScreen />);
  fireEvent(screen.getByLabelText('Transfer Requested push'), 'valueChange', false);
  expect(savePrefs).toHaveBeenCalledWith(expect.objectContaining({
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
  expect(savePolicy).toHaveBeenCalledWith(expect.objectContaining({ digest_minutes: 30 }));
});
