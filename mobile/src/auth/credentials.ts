import * as SecureStore from 'expo-secure-store';
import { logger } from '@/utils/logger';

const API_TOKEN_KEY = 'hcp.api_token';

/**
 * The Housecall Pro credential lives in the iOS Keychain / Android Keystore and
 * nowhere else — not in the bundle, not in AsyncStorage, not in SQLite.
 *
 * `THIS_DEVICE_ONLY` is the load-bearing half: the key must not ride an iCloud
 * Keychain backup onto a tech's personal device.
 *
 * `AFTER_FIRST_UNLOCK` rather than `WHEN_UNLOCKED` is a deliberate trade the
 * background uploader forces. iOS schedules `BGProcessingTask` when the phone
 * is charging and idle, which in practice means locked and face-down on a
 * nightstand. A `WHEN_UNLOCKED` item is unreadable in exactly that window, so
 * every overnight upload would fail on a credential the app genuinely has. The
 * cost is that the key is readable by the app between first unlock and reboot;
 * the benefit is that a day of attic photos actually leaves the phone.
 */
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** In-memory cache — the queue asks for this on every upload attempt. */
let cachedToken: string | null | undefined;

export async function getApiToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(API_TOKEN_KEY, STORE_OPTIONS);
  } catch (error) {
    logger.error('credentials.read.failed', { error: String(error) });
    cachedToken = null;
  }
  return cachedToken;
}

export async function setApiToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('API key cannot be empty');
  await SecureStore.setItemAsync(API_TOKEN_KEY, trimmed, STORE_OPTIONS);
  cachedToken = trimmed;
}

export async function clearApiToken(): Promise<void> {
  await SecureStore.deleteItemAsync(API_TOKEN_KEY, STORE_OPTIONS);
  cachedToken = null;
}

export async function hasApiToken(): Promise<boolean> {
  return (await getApiToken()) !== null;
}
