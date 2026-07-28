import axios from 'axios';
import { installRefreshOn401 } from '../refreshOn401';
import { clear, getCached, save } from '../../tokenStore';
import { emit } from '../../events';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn(), default: { ...actual, post: jest.fn() } };
});
jest.mock('../../tokenStore', () => ({
  getCached: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../events', () => ({ emit: jest.fn() }));

const mockPost = (axios as unknown as { post: jest.Mock }).post;

function makeClient() {
  const client = {
    interceptors: { response: { use: jest.fn() } },
    request: jest.fn().mockResolvedValue({ status: 200 }),
  };
  installRefreshOn401(client as never);
  const onRejected = client.interceptors.response.use.mock.calls[0][1] as (
    error: unknown
  ) => Promise<unknown>;
  return { client, onRejected };
}

function expired401Error() {
  return {
    config: { url: '/tools/', headers: { set: jest.fn() } },
    response: { status: 401 },
  };
}

describe('refreshOn401 failure classification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCached as jest.Mock).mockReturnValue({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: null,
    });
  });

  it('keeps tokens and does not end the session when refresh times out (no response)', async () => {
    const { onRejected } = makeClient();
    mockPost.mockRejectedValueOnce(
      Object.assign(new Error('timeout of 15000ms exceeded'), {
        isAxiosError: true,
        code: 'ECONNABORTED',
      })
    );
    await expect(onRejected(expired401Error())).rejects.toBeTruthy();
    expect(clear).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalledWith('session-expired', undefined);
  });

  it('keeps tokens when the refresh endpoint returns 503 (WorkOS down)', async () => {
    const { onRejected } = makeClient();
    mockPost.mockRejectedValueOnce(
      Object.assign(new Error('503'), {
        isAxiosError: true,
        response: { status: 503, data: { code: 'upstream_unavailable' } },
      })
    );
    await expect(onRejected(expired401Error())).rejects.toBeTruthy();
    expect(clear).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalledWith('session-expired', undefined);
  });

  it('clears tokens and ends the session when the refresh token is rejected (401)', async () => {
    const { onRejected } = makeClient();
    mockPost.mockRejectedValueOnce(
      Object.assign(new Error('401'), {
        isAxiosError: true,
        response: { status: 401, data: { code: 'token_invalid' } },
      })
    );
    await expect(onRejected(expired401Error())).rejects.toBeTruthy();
    expect(clear).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('session-expired', undefined);
  });

  it('saves rotated tokens and retries the original request on success', async () => {
    const { client, onRejected } = makeClient();
    mockPost.mockResolvedValueOnce({
      data: {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      },
    });
    await onRejected(expired401Error());
    expect(save).toHaveBeenCalledWith({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresInSeconds: 3600,
    });
    expect(client.request).toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
});
