import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  PIN_HASH: 'wb.pinAuth.hash',
  PIN_SALT: 'wb.pinAuth.salt',
  FAILED_ATTEMPTS: 'wb.pinAuth.failedAttempts',
} as const;

const MAX_FAILED_ATTEMPTS = 5;

const generateSalt = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const hashPin = async (pin: string, salt: string): Promise<string> => {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
};

export interface PinVerifyResult {
  success: boolean;
  attemptsRemaining: number;
  locked: boolean;
}

export const PinAuthService = {
  async setPin(pin: string): Promise<void> {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error('PIN must be 4 to 6 digits');
    }
    const salt = await generateSalt();
    const hash = await hashPin(pin, salt);
    await SecureStore.setItemAsync(KEYS.PIN_HASH, hash, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(KEYS.PIN_SALT, salt, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(KEYS.FAILED_ATTEMPTS, '0');
  },

  async hasPin(): Promise<boolean> {
    const hash = await SecureStore.getItemAsync(KEYS.PIN_HASH);
    return !!hash;
  },

  async verifyPin(pin: string): Promise<PinVerifyResult> {
    const [hash, salt, attemptsStr] = await Promise.all([
      SecureStore.getItemAsync(KEYS.PIN_HASH),
      SecureStore.getItemAsync(KEYS.PIN_SALT),
      SecureStore.getItemAsync(KEYS.FAILED_ATTEMPTS),
    ]);

    if (!hash || !salt) {
      return { success: false, attemptsRemaining: 0, locked: true };
    }

    const attempts = parseInt(attemptsStr || '0', 10);
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      return { success: false, attemptsRemaining: 0, locked: true };
    }

    const candidate = await hashPin(pin, salt);
    if (candidate === hash) {
      await SecureStore.setItemAsync(KEYS.FAILED_ATTEMPTS, '0');
      return { success: true, attemptsRemaining: MAX_FAILED_ATTEMPTS, locked: false };
    }

    const newAttempts = attempts + 1;
    await SecureStore.setItemAsync(KEYS.FAILED_ATTEMPTS, String(newAttempts));
    return {
      success: false,
      attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - newAttempts),
      locked: newAttempts >= MAX_FAILED_ATTEMPTS,
    };
  },

  async clearPin(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.PIN_HASH);
    await SecureStore.deleteItemAsync(KEYS.PIN_SALT);
    await SecureStore.deleteItemAsync(KEYS.FAILED_ATTEMPTS);
  },

  async getFailedAttempts(): Promise<number> {
    const v = await SecureStore.getItemAsync(KEYS.FAILED_ATTEMPTS);
    return parseInt(v || '0', 10);
  },

  get maxAttempts() {
    return MAX_FAILED_ATTEMPTS;
  },
};

export default PinAuthService;
