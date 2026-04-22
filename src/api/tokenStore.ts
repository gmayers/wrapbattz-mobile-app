import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'tt_access_token';
const REFRESH_KEY = 'tt_refresh_token';
const EXPIRES_AT_KEY = 'tt_access_expires_at';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

let cached: StoredTokens | null = null;
let hydrated = false;

export async function hydrate(): Promise<StoredTokens | null> {
  if (hydrated) return cached;
  const [accessToken, refreshToken, expiresAtRaw] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(EXPIRES_AT_KEY),
  ]);
  hydrated = true;
  if (!accessToken || !refreshToken) {
    cached = null;
    return null;
  }
  cached = {
    accessToken,
    refreshToken,
    expiresAt: expiresAtRaw ? Number(expiresAtRaw) : null,
  };
  return cached;
}

export function getCached(): StoredTokens | null {
  return cached;
}

export async function save(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds?: number;
}): Promise<void> {
  const expiresAt = tokens.expiresInSeconds
    ? Date.now() + tokens.expiresInSeconds * 1000
    : null;
  cached = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt,
  };
  hydrated = true;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
    expiresAt === null
      ? SecureStore.deleteItemAsync(EXPIRES_AT_KEY)
      : SecureStore.setItemAsync(EXPIRES_AT_KEY, String(expiresAt)),
  ]);
}

export async function clear(): Promise<void> {
  cached = null;
  hydrated = true;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(EXPIRES_AT_KEY),
  ]);
}
