import * as SecureStore from 'expo-secure-store';
import { logger } from '@/utils/logger';

const API_TOKEN_KEY = 'hcp.api_token';

/**
 * The Housecall Pro credential lives in the iOS Keychain / Android Keystore and
 * nowhere else — not in the bundle, not in AsyncStorage, not in SQLite.
 *
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is deliberate: the key must not ride an
 * iCloud Keychain backup onto a tech's personal device, and the sync worker
 * only ever runs while the phone is unlocked and in the foreground anyway.
 */
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
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
