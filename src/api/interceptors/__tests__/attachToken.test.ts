import type { InternalAxiosRequestConfig } from 'axios';
import { attachToken } from '../attachToken';
import { getCached } from '../../tokenStore';
import { refreshOnce } from '../refreshOn401';

jest.mock('../../tokenStore', () => ({
  getCached: jest.fn(),
  hydrate: jest.fn().mockResolvedValue(null),
}));
jest.mock('../refreshOn401', () => ({
  refreshOnce: jest.fn(),
  installRefreshOn401: jest.fn(),
}));

function makeConfig(url: string): InternalAxiosRequestConfig {
  return { url, headers: { set: jest.fn() } } as unknown as InternalAxiosRequestConfig;
}

function tokens(expiresInMs: number | null) {
  return {
    accessToken: 'cached-access',
    refreshToken: 'cached-refresh',
    expiresAt: expiresInMs === null ? null : Date.now() + expiresInMs,
  };
}

describe('attachToken proactive refresh', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refreshes first when the token expires within the skew window', async () => {
    (getCached as jest.Mock).mockReturnValue(tokens(30_000)); // 30s left
    (refreshOnce as jest.Mock).mockResolvedValue('fresh-access');
    const config = await attachToken(makeConfig('/tools/'));
    expect(refreshOnce).toHaveBeenCalled();
    expect(config.headers.set).toHaveBeenCalledWith(
      'Authorization',
      'Bearer fresh-access'
    );
  });

  it('refreshes first when the token is already expired', async () => {
    (getCached as jest.Mock).mockReturnValue(tokens(-5_000));
    (refreshOnce as jest.Mock).mockResolvedValue('fresh-access');
    const config = await attachToken(makeConfig('/tools/'));
    expect(refreshOnce).toHaveBeenCalled();
    expect(config.headers.set).toHaveBeenCalledWith(
      'Authorization',
      'Bearer fresh-access'
    );
  });

  it('does not refresh when the token has plenty of life left', async () => {
    (getCached as jest.Mock).mockReturnValue(tokens(30 * 60_000)); // 30min
    const config = await attachToken(makeConfig('/tools/'));
    expect(refreshOnce).not.toHaveBeenCalled();
    expect(config.headers.set).toHaveBeenCalledWith(
      'Authorization',
      'Bearer cached-access'
    );
  });

  it('falls back to the cached token when proactive refresh fails transiently', async () => {
    (getCached as jest.Mock).mockReturnValue(tokens(30_000));
    (refreshOnce as jest.Mock).mockResolvedValue(null);
    const config = await attachToken(makeConfig('/tools/'));
    expect(config.headers.set).toHaveBeenCalledWith(
      'Authorization',
      'Bearer cached-access'
    );
  });

  it('never refreshes for anonymous endpoints', async () => {
    (getCached as jest.Mock).mockReturnValue(tokens(-5_000));
    const config = await attachToken(makeConfig('/auth/login/'));
    expect(refreshOnce).not.toHaveBeenCalled();
    expect(config.headers.set).not.toHaveBeenCalled();
  });
});
