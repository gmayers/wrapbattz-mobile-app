import { apiClient } from '../../client';
import * as organizations from '../organizations';

jest.mock('../../client', () => ({
  apiClient: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const config = {
  enabled: true,
  code_type: 'pin',
  code: '1234',
  password_hex: '000004D2',
  pack_hex: 'A1B2',
  previous_password_hex: null,
  previous_pack_hex: null,
  updated_at: '2026-10-05T10:00:00Z',
};

describe('NFC lock endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /organizations/me/nfc-lock/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: config });
    await expect(organizations.getNfcLock()).resolves.toEqual(config);
    expect(apiClient.get).toHaveBeenCalledWith('/organizations/me/nfc-lock/');
  });

  it('PUT sets a code', async () => {
    (apiClient.put as jest.Mock).mockResolvedValueOnce({ data: config });
    await organizations.setNfcLock({ code_type: 'hex', code: '3F9A01C7' });
    expect(apiClient.put).toHaveBeenCalledWith('/organizations/me/nfc-lock/', { code_type: 'hex', code: '3F9A01C7' });
  });

  it('PUT generates a code', async () => {
    (apiClient.put as jest.Mock).mockResolvedValueOnce({ data: config });
    await organizations.setNfcLock({ generate: true });
    expect(apiClient.put).toHaveBeenCalledWith('/organizations/me/nfc-lock/', { generate: true });
  });

  it('DELETE turns the lock off', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValueOnce({ data: { ...config, enabled: false } });
    await expect(organizations.disableNfcLock()).resolves.toMatchObject({ enabled: false });
    expect(apiClient.delete).toHaveBeenCalledWith('/organizations/me/nfc-lock/');
  });
});
