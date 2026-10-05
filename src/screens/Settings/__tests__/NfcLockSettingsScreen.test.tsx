import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NfcLockSettingsScreen, { validateLockCode } from '../NfcLockSettingsScreen';
import * as organizationsApi from '../../../api/endpoints/organizations';
import { ApiError } from '../../../api/errors';
import { clearNfcLockCache, peekNfcLockConfig } from '../../../services/nfcLockStore';

jest.mock('../../../api/endpoints/organizations', () => ({
  getNfcLock: jest.fn(),
  setNfcLock: jest.fn(),
  disableNfcLock: jest.fn(),
  getMyOrganization: jest.fn(),
}));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: new Proxy({}, { get: () => '#000000' }) }),
}));
const mockAuth: any = { user: { id: 1 }, isAdminOrOwner: true };
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const on = {
  enabled: true,
  code_type: 'pin',
  code: '4821',
  password_hex: '000012D5',
  pack_hex: 'A1B2',
  previous_password_hex: null,
  previous_pack_hex: null,
  updated_at: '2026-10-05T10:00:00Z',
};
const off = { ...on, enabled: false, code: null, code_type: null, password_hex: null, pack_hex: null };

const text = (el: any): string => [].concat(el.props.children).join('');

beforeEach(() => {
  jest.clearAllMocks();
  clearNfcLockCache();
  mockAuth.isAdminOrOwner = true;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

it('validates PINs and hex codes', () => {
  expect(validateLockCode('pin', '1234')).toBeNull();
  expect(validateLockCode('pin', '12345678')).toBeNull();
  expect(validateLockCode('pin', '123')).not.toBeNull();
  expect(validateLockCode('pin', '12a4')).not.toBeNull();
  expect(validateLockCode('hex', '3f9a01c7')).toBeNull();
  expect(validateLockCode('hex', '3F9A01C')).not.toBeNull();
  expect(validateLockCode('hex', '3F9A01CG')).not.toBeNull();
});

it('masks the code until revealed', async () => {
  (organizationsApi.getNfcLock as jest.Mock).mockResolvedValue(on);
  render(<NfcLockSettingsScreen />);
  expect(text(await screen.findByTestId('nfc-lock-code'))).toBe('••••');
  expect(screen.queryByText('4821')).toBeNull();
  fireEvent.press(screen.getByLabelText('Show lock code'));
  expect(text(screen.getByTestId('nfc-lock-code'))).toBe('4821');
  fireEvent.press(screen.getByLabelText('Hide lock code'));
  expect(screen.queryByText('4821')).toBeNull();
});

it('sets a hex code (uppercased) and caches the result for writes', async () => {
  (organizationsApi.getNfcLock as jest.Mock).mockResolvedValue(off);
  const saved = { ...on, code_type: 'hex', code: '3F9A01C7', password_hex: '3F9A01C7' };
  (organizationsApi.setNfcLock as jest.Mock).mockResolvedValue(saved);
  render(<NfcLockSettingsScreen />);
  fireEvent.press(await screen.findByTestId('nfc-lock-type-hex'));
  fireEvent.changeText(screen.getByTestId('nfc-lock-input'), '3f9a01c7');
  await act(async () => {
    fireEvent.press(screen.getByTestId('nfc-lock-save'));
  });
  expect(organizationsApi.setNfcLock).toHaveBeenCalledWith({ code_type: 'hex', code: '3F9A01C7' });
  expect(peekNfcLockConfig({ userId: 1, isAdminOrOwner: true })).toEqual(saved);
  expect(text(screen.getByTestId('nfc-lock-status'))).toBe('On');
});

it('rejects a bad PIN without calling the server', async () => {
  (organizationsApi.getNfcLock as jest.Mock).mockResolvedValue(off);
  render(<NfcLockSettingsScreen />);
  fireEvent.changeText(await screen.findByTestId('nfc-lock-input'), '12');
  await act(async () => {
    fireEvent.press(screen.getByTestId('nfc-lock-save'));
  });
  expect(organizationsApi.setNfcLock).not.toHaveBeenCalled();
  expect(text(screen.getByTestId('nfc-lock-error'))).toBe('Enter 4 to 8 digits.');
});

it('shows the server validation message', async () => {
  (organizationsApi.getNfcLock as jest.Mock).mockResolvedValue(off);
  (organizationsApi.setNfcLock as jest.Mock).mockRejectedValue(
    new ApiError({ code: 'validation', status: 422, message: 'PIN too simple.', detail: { detail: [{ loc: ['body', 'code'], msg: 'PIN too simple.' }] } })
  );
  render(<NfcLockSettingsScreen />);
  fireEvent.changeText(await screen.findByTestId('nfc-lock-input'), '1111');
  await act(async () => {
    fireEvent.press(screen.getByTestId('nfc-lock-save'));
  });
  expect(text(screen.getByTestId('nfc-lock-error'))).toBe('PIN too simple.');
});

it('generates a code and shows it', async () => {
  (organizationsApi.getNfcLock as jest.Mock).mockResolvedValue(off);
  (organizationsApi.setNfcLock as jest.Mock).mockResolvedValue({ ...on, code_type: 'hex', code: 'A1B2C3D4' });
  render(<NfcLockSettingsScreen />);
  const generate = await screen.findByTestId('nfc-lock-generate');
  await act(async () => {
    fireEvent.press(generate);
  });
  expect(organizationsApi.setNfcLock).toHaveBeenCalledWith({ generate: true });
  expect(text(screen.getByTestId('nfc-lock-code'))).toBe('A1B2C3D4');
});

it('turns the lock off after confirming', async () => {
  (organizationsApi.getNfcLock as jest.Mock).mockResolvedValue(on);
  (organizationsApi.disableNfcLock as jest.Mock).mockResolvedValue({ ...off, previous_password_hex: '000012D5', previous_pack_hex: 'A1B2' });
  render(<NfcLockSettingsScreen />);
  fireEvent.press(await screen.findByTestId('nfc-lock-disable'));
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => {
    buttons.find((b: any) => b.text === 'Turn off').onPress();
  });
  expect(organizationsApi.disableNfcLock).toHaveBeenCalled();
  expect(text(screen.getByTestId('nfc-lock-status'))).toBe('Off');
  expect(screen.getByText(/old code can still be updated/)).toBeTruthy();
});

it('never loads the code for other roles', async () => {
  mockAuth.isAdminOrOwner = false;
  render(<NfcLockSettingsScreen />);
  await act(async () => {});
  expect(organizationsApi.getNfcLock).not.toHaveBeenCalled();
  expect(screen.getByText('Only owners and admins can manage the NFC tag lock.')).toBeTruthy();
});
