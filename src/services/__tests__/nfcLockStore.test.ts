import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import * as organizationsApi from '../../api/endpoints/organizations';
import { emit } from '../../api/events';
import { ApiError } from '../../api/errors';
import {
  clearNfcLockCache,
  getNfcLockConfig,
  keysFromConfig,
  LOCK_UNAVAILABLE_MESSAGE,
  ONLY_ADMINS_MESSAGE,
  peekNfcLockConfig,
  resolveTagLockForWrite,
  setNfcLockConfig,
} from '../nfcLockStore';

jest.mock('../../api/endpoints/organizations', () => ({
  getNfcLock: jest.fn(),
  getMyOrganization: jest.fn(),
}));

const getNfcLock = organizationsApi.getNfcLock as jest.Mock;
const getMyOrganization = organizationsApi.getMyOrganization as jest.Mock;

const admin = { userId: 1, isAdminOrOwner: true };
const worker = { userId: 2, isAdminOrOwner: false };

const config = {
  enabled: true,
  code_type: 'pin' as const,
  code: '1234',
  password_hex: '000004D2',
  pack_hex: 'A1B2',
  previous_password_hex: '3F9A01C7',
  previous_pack_hex: '1122',
  updated_at: '2026-10-05T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  clearNfcLockCache();
});

describe('who gets the code', () => {
  it('never fetches the lock code for non-admins', async () => {
    getMyOrganization.mockResolvedValue({ nfc_lock_enabled: true });
    await expect(getNfcLockConfig(worker)).resolves.toBeNull();
    await expect(resolveTagLockForWrite(worker)).resolves.toEqual({ ok: false, lock: null, message: ONLY_ADMINS_MESSAGE });
    expect(getNfcLock).not.toHaveBeenCalled();
  });

  it('lets non-admins write when the org has no lock', async () => {
    getMyOrganization.mockResolvedValue({ nfc_lock_enabled: false });
    await expect(resolveTagLockForWrite(worker)).resolves.toEqual({ ok: true, lock: null });
    expect(getNfcLock).not.toHaveBeenCalled();
  });

  it('gives admins the current and previous keys', async () => {
    getNfcLock.mockResolvedValue(config);
    await expect(resolveTagLockForWrite(admin)).resolves.toEqual({
      ok: true,
      lock: {
        enabled: true,
        current: { password: [0x00, 0x00, 0x04, 0xd2], pack: [0xa1, 0xb2] },
        previous: { password: [0x3f, 0x9a, 0x01, 0xc7], pack: [0x11, 0x22] },
      },
    });
  });

  it('blocks admin writes when the code cannot be loaded', async () => {
    getNfcLock.mockRejectedValue(new ApiError({ code: 'network', message: 'offline' }));
    await expect(resolveTagLockForWrite(admin)).resolves.toEqual({ ok: false, lock: null, message: LOCK_UNAVAILABLE_MESSAGE });
  });

  it('treats a missing endpoint (404) as no lock', async () => {
    getNfcLock.mockRejectedValue(new ApiError({ code: 'not_found', message: 'nope' }));
    await expect(resolveTagLockForWrite(admin)).resolves.toEqual({ ok: true, lock: null });
  });
});

describe('keysFromConfig', () => {
  it('lock off with a previous code → previous only, not enabled', () => {
    expect(
      keysFromConfig({ ...config, enabled: false, code: null, code_type: null, password_hex: null, pack_hex: null })
    ).toEqual({ enabled: false, current: null, previous: { password: [0x3f, 0x9a, 0x01, 0xc7], pack: [0x11, 0x22] } });
  });

  it('no code at all → null', () => {
    expect(
      keysFromConfig({
        ...config,
        enabled: false,
        password_hex: null,
        pack_hex: null,
        previous_password_hex: null,
        previous_pack_hex: null,
      })
    ).toBeNull();
  });
});

describe('session cache', () => {
  it('fetches once per session and shares in-flight requests', async () => {
    getNfcLock.mockResolvedValue(config);
    await Promise.all([getNfcLockConfig(admin), getNfcLockConfig(admin)]);
    await getNfcLockConfig(admin);
    expect(getNfcLock).toHaveBeenCalledTimes(1);
    expect(peekNfcLockConfig(admin)).toEqual(config);
  });

  it('does not hand one user another user’s cached config', async () => {
    getNfcLock.mockResolvedValue(config);
    await getNfcLockConfig(admin);
    expect(peekNfcLockConfig({ userId: 99, isAdminOrOwner: true })).toBeUndefined();
    expect(peekNfcLockConfig({ ...admin, isAdminOrOwner: false })).toBeUndefined();
  });

  it('uses a config saved from settings straight away', async () => {
    setNfcLockConfig(admin, config);
    await getNfcLockConfig(admin);
    expect(getNfcLock).not.toHaveBeenCalled();
  });

  it('drops the code on sign-out', async () => {
    getNfcLock.mockResolvedValue(config);
    await getNfcLockConfig(admin);
    emit('tokens-cleared', undefined);
    expect(peekNfcLockConfig(admin)).toBeUndefined();
  });

  it('refetches after the app returns to the foreground', async () => {
    let handler: ((s: string) => void) | undefined;
    const add = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: any) => {
      handler = fn;
      return { remove: jest.fn() };
    }) as any);
    let store: typeof import('../nfcLockStore');
    jest.isolateModules(() => {
      store = require('../nfcLockStore');
    });
    getNfcLock.mockResolvedValue(config);
    await store!.getNfcLockConfig(admin);
    expect(handler).toBeDefined();
    handler!('background');
    handler!('active');
    expect(store!.peekNfcLockConfig(admin)).toBeUndefined();
    await store!.getNfcLockConfig(admin);
    expect(getNfcLock).toHaveBeenCalledTimes(2);
    add.mockRestore();
  });

  it('never persists or logs the code', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => {})
    );
    getNfcLock.mockResolvedValue(config);
    await resolveTagLockForWrite(admin);
    setNfcLockConfig(admin, config);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain('1234');
    expect(logged).not.toContain('000004D2');
    spies.forEach((s) => s.mockRestore());
  });
});
