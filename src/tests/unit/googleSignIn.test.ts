jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(16).fill(0xab)),
}));
jest.mock('../../api/endpoints/auth', () => ({
  oauthAuthorize: jest.fn(),
  oauthCallback: jest.fn(),
}));

import * as WebBrowser from 'expo-web-browser';
import { oauthAuthorize, oauthCallback } from '../../api/endpoints/auth';
import {
  parseOAuthRedirect,
  signInWithGoogle,
  googleSignInAlert,
  OAuthRedirectError,
  REDIRECT_URI,
} from '../../auth/googleSignIn';
import { ApiError } from '../../api/errors';

const mockedOpen = WebBrowser.openAuthSessionAsync as jest.Mock;
const mockedAuthorize = oauthAuthorize as jest.Mock;
const mockedCallback = oauthCallback as jest.Mock;

describe('parseOAuthRedirect', () => {
  const S = 'expected-state';
  it('extracts the code when state matches', () => {
    expect(parseOAuthRedirect(`tooltraq://auth/callback?code=c123&state=${S}`, S)).toEqual({ code: 'c123' });
  });
  it('decodes URL-encoded values', () => {
    expect(parseOAuthRedirect(`tooltraq://auth/callback?code=a%2Bb&state=${S}`, S)).toEqual({ code: 'a+b' });
  });
  it('throws state_mismatch when state differs', () => {
    expect(() => parseOAuthRedirect(`tooltraq://auth/callback?code=c&state=evil`, S))
      .toThrow(expect.objectContaining({ reason: 'state_mismatch' }));
  });
  it('throws state_mismatch when state is absent', () => {
    expect(() => parseOAuthRedirect('tooltraq://auth/callback?code=c', S))
      .toThrow(expect.objectContaining({ reason: 'state_mismatch' }));
  });
  it('throws missing_code when code is absent', () => {
    expect(() => parseOAuthRedirect(`tooltraq://auth/callback?state=${S}`, S))
      .toThrow(expect.objectContaining({ reason: 'missing_code' }));
  });
  it('throws provider_error when the provider returned an error param', () => {
    expect(() => parseOAuthRedirect(`tooltraq://auth/callback?error=access_denied&state=${S}`, S))
      .toThrow(expect.objectContaining({ reason: 'provider_error' }));
  });
  it('throws missing_code on a URL with no query string', () => {
    expect(() => parseOAuthRedirect('tooltraq://auth/callback', S))
      .toThrow(expect.objectContaining({ reason: 'missing_code' }));
  });
});

describe('signInWithGoogle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('completes the round trip and returns the token response', async () => {
    mockedAuthorize.mockResolvedValueOnce({ authorization_url: 'https://workos.example/authz' });
    // state is deterministic because getRandomBytesAsync is mocked to 0xab bytes
    const state = 'ab'.repeat(16);
    mockedOpen.mockResolvedValueOnce({
      type: 'success',
      url: `tooltraq://auth/callback?code=ok&state=${state}`,
    });
    const tokens = { access_token: 'a', refresh_token: 'r', expires_in: 1, user: { id: 1 } };
    mockedCallback.mockResolvedValueOnce(tokens);

    const res = await signInWithGoogle('sign-up');

    expect(mockedAuthorize).toHaveBeenCalledWith({
      provider: 'GoogleOAuth',
      state,
      screen_hint: 'sign-up',
    });
    expect(mockedOpen).toHaveBeenCalledWith('https://workos.example/authz', REDIRECT_URI);
    expect(mockedCallback).toHaveBeenCalledWith('ok');
    expect(res).toEqual(tokens);
  });

  it('returns null when the user cancels the browser', async () => {
    mockedAuthorize.mockResolvedValueOnce({ authorization_url: 'https://x' });
    mockedOpen.mockResolvedValueOnce({ type: 'cancel' });
    expect(await signInWithGoogle('sign-in')).toBeNull();
    expect(mockedCallback).not.toHaveBeenCalled();
  });

  it('returns null when the provider redirect carries an error param (user denied)', async () => {
    mockedAuthorize.mockResolvedValueOnce({ authorization_url: 'https://x' });
    mockedOpen.mockResolvedValueOnce({
      type: 'success',
      url: 'tooltraq://auth/callback?error=access_denied&state=' + 'ab'.repeat(16),
    });
    expect(await signInWithGoogle('sign-in')).toBeNull();
    expect(mockedCallback).not.toHaveBeenCalled();
  });

  it('throws on state mismatch and never calls the callback endpoint', async () => {
    mockedAuthorize.mockResolvedValueOnce({ authorization_url: 'https://x' });
    mockedOpen.mockResolvedValueOnce({
      type: 'success',
      url: 'tooltraq://auth/callback?code=c&state=evil',
    });
    await expect(signInWithGoogle('sign-in')).rejects.toMatchObject({ reason: 'state_mismatch' });
    expect(mockedCallback).not.toHaveBeenCalled();
  });
});

describe('googleSignInAlert', () => {
  // ApiError uses a shape-object constructor; a backend 503 arrives as
  // code 'server' + status 503, and the backend's 401 oauth_failed arrives
  // as code 'unauthorized' + status 401 (fromAxiosError maps by HTTP status).
  it('maps a 503 (backend not configured) to the not-available message', () => {
    const err = new ApiError({ code: 'server', status: 503, message: 'Google sign-in is not configured.' });
    expect(googleSignInAlert(err)).toEqual({
      title: 'Google sign-in unavailable',
      message: "Google sign-in isn't available yet. Please use email and password.",
    });
  });
  it('maps OAuthRedirectError to the generic retry message', () => {
    expect(googleSignInAlert(new OAuthRedirectError('state_mismatch'))).toEqual({
      title: 'Google sign-in failed',
      message: 'Google sign-in failed. Please try again.',
    });
  });
  it('shows the server message for a 401 oauth_failed (NOT swallowed as session-expiry)', () => {
    const err = new ApiError({ code: 'unauthorized', status: 401, message: 'Google sign-in could not be completed.' });
    expect(googleSignInAlert(err)).toEqual({
      title: 'Google sign-in failed',
      message: 'Google sign-in could not be completed.',
    });
  });
  it('uses the error message for other ApiErrors (e.g. network)', () => {
    const err = new ApiError({ code: 'network', message: 'Network error — check your connection.' });
    expect(googleSignInAlert(err)).toEqual({
      title: 'Google sign-in failed',
      message: 'Network error — check your connection.',
    });
  });
});
