import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { oauthAuthorize, oauthCallback } from '@/api/endpoints/auth';
import { ApiError } from '@/api/errors';
import type { TokenResponse } from '@/api/types';

export const REDIRECT_URI = 'tooltraq://auth/callback';

export type OAuthRedirectFailure = 'state_mismatch' | 'missing_code' | 'provider_error';

export class OAuthRedirectError extends Error {
  reason: OAuthRedirectFailure;
  /** Raw `error` param from the provider redirect (e.g. 'access_denied'). */
  providerError?: string;
  constructor(reason: OAuthRedirectFailure, providerError?: string) {
    super(`oauth_redirect_${reason}`);
    this.name = 'OAuthRedirectError';
    this.reason = reason;
    this.providerError = providerError;
  }
}

// React Native's URL polyfill throws on .searchParams (Node's URL in Jest
// hides this), so parse the query string by hand.
function queryParams(url: string): Record<string, string> {
  const query = url.split('#')[0].split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split('=');
    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join('=') || '');
    } catch {
      // Skip malformed percent-encoding rather than crash the flow.
    }
  }
  return out;
}

export function parseOAuthRedirect(
  url: string,
  expectedState: string
): { code: string } {
  const params = queryParams(url);
  if (params.error) throw new OAuthRedirectError('provider_error', params.error);
  // Check code before state: a URL with no query string at all (no code,
  // no state) must report missing_code, not state_mismatch — only a URL
  // that carries a code but the wrong (or absent) state is a mismatch.
  if (!params.code) throw new OAuthRedirectError('missing_code');
  if (params.state !== expectedState) throw new OAuthRedirectError('state_mismatch');
  return { code: params.code };
}

async function randomState(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Full native Google OAuth round trip.
 * Returns null when the user cancels/dismisses the browser or denies consent.
 * Throws OAuthRedirectError (state mismatch / malformed redirect) or ApiError.
 */
export async function signInWithGoogle(
  screenHint: 'sign-in' | 'sign-up'
): Promise<TokenResponse | null> {
  const state = await randomState();
  const { authorization_url } = await oauthAuthorize({
    provider: 'GoogleOAuth',
    state,
    screen_hint: screenHint,
  });

  const result = await WebBrowser.openAuthSessionAsync(authorization_url, REDIRECT_URI);
  if (result.type !== 'success') return null; // cancel | dismiss | locked

  let code: string;
  try {
    ({ code } = parseOAuthRedirect(result.url, state));
  } catch (err) {
    if (
      err instanceof OAuthRedirectError &&
      err.reason === 'provider_error' &&
      err.providerError === 'access_denied'
    ) {
      return null; // user denied consent at Google — treat like cancel
    }
    // Any other provider error (invalid_scope, server_error, …) is a real
    // configuration/backend failure — surface it, don't mask it as a cancel.
    throw err;
  }
  return oauthCallback(code);
}

/**
 * Maps a signInWithGoogle failure to alert copy.
 * Note: unlike the rest of the app, a 401 ('unauthorized') from the OAuth
 * endpoints is shown, not skipped — they are unauthenticated endpoints
 * (excluded from the refresh interceptor), so 401 means oauth_failed,
 * not an expired session.
 */
export function googleSignInAlert(
  err: unknown
): { title: string; message: string } {
  if (err instanceof OAuthRedirectError) {
    return {
      title: 'Google sign-in failed',
      message: 'Google sign-in failed. Please try again.',
    };
  }
  if (err instanceof ApiError) {
    if (err.status === 503) {
      return {
        title: 'Google sign-in unavailable',
        message: "Google sign-in isn't available yet. Please use email and password.",
      };
    }
    return {
      title: 'Google sign-in failed',
      message: err.message || 'Google sign-in could not be completed.',
    };
  }
  return {
    title: 'Google sign-in failed',
    message: 'Google sign-in failed. Please try again.',
  };
}
