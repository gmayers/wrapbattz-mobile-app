import { apiClient } from '../client';
import { clear, save } from '../tokenStore';
import { emit } from '../events';
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  TokenResponse,
  VerifyEmailRequest,
  VerifyPendingResponse,
} from '../types';

async function persistTokenResponse(response: TokenResponse): Promise<TokenResponse> {
  await save({
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresInSeconds: response.expires_in,
  });
  emit('tokens-updated', undefined);
  return response;
}

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/login/', payload);
  return persistTokenResponse(data);
}

export async function refresh(refreshToken: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/token/refresh/', {
    refresh_token: refreshToken,
  });
  return persistTokenResponse(data);
}

export async function register(payload: RegisterRequest): Promise<VerifyPendingResponse> {
  const { data } = await apiClient.post<VerifyPendingResponse>('/auth/register/', payload);
  return data;
}

export async function verifyEmail(payload: VerifyEmailRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/verify-email/', payload);
  return persistTokenResponse(data);
}

export async function forgotPassword(payload: ForgotPasswordRequest): Promise<void> {
  await apiClient.post('/auth/password/forgot/', payload);
}

export async function resetPassword(payload: ResetPasswordRequest): Promise<void> {
  await apiClient.post('/auth/password/reset/', payload);
}

export async function changePassword(payload: ChangePasswordRequest): Promise<void> {
  await apiClient.post('/auth/password/change/', payload);
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout/');
  } catch {
    // Log out locally even if the server call fails.
  } finally {
    await clear();
    emit('tokens-cleared', undefined);
  }
}
