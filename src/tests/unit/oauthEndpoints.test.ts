import { apiClient } from '@/api/client';
import { oauthAuthorize, oauthCallback } from '@/api/endpoints/auth';

jest.mock('@/api/client', () => ({
  apiClient: { post: jest.fn() },
}));
jest.mock('@/api/tokenStore', () => ({
  save: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

const mockedPost = apiClient.post as jest.Mock;

describe('oauthAuthorize', () => {
  it('POSTs the authorize payload and returns the authorization URL', async () => {
    mockedPost.mockResolvedValueOnce({ data: { authorization_url: 'https://auth.example/x' } });
    const res = await oauthAuthorize({ provider: 'GoogleOAuth', state: 'abc', screen_hint: 'sign-in' });
    expect(mockedPost).toHaveBeenCalledWith('/auth/oauth/authorize/', {
      provider: 'GoogleOAuth',
      state: 'abc',
      screen_hint: 'sign-in',
    });
    expect(res.authorization_url).toBe('https://auth.example/x');
  });
});

describe('oauthCallback', () => {
  it('POSTs the code and persists the token response', async () => {
    const tokens = {
      access_token: 'A'.repeat(20),
      refresh_token: 'R'.repeat(20),
      expires_in: 3600,
      user: { id: 1, email: 'a@b.com' },
    };
    mockedPost.mockResolvedValueOnce({ data: tokens });
    const res = await oauthCallback('the-code');
    expect(mockedPost).toHaveBeenCalledWith('/auth/oauth/callback/', { code: 'the-code' });
    const { save } = require('@/api/tokenStore');
    expect(save).toHaveBeenCalledWith({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expires_in,
    });
    expect(res).toEqual(tokens);
  });
});
