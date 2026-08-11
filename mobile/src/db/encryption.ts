import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { logger } from '@/utils/logger';

const DB_KEY_NAME = 'db.sqlcipher_key';

/**
 * At-rest protection for the offline queue.
 *
 * What is actually true today, stated plainly so nobody assumes more:
 *
 *  - The API credential is in the Keychain/Keystore (`auth/credentials.ts`).
 *    That is real hardware-backed encryption.
 *  - The SQLite file and the photo files live in the app sandbox, covered by
 *    iOS Data Protection and Android File-Based Encryption. Encrypted at rest
 *    while the device is locked; readable by the app when unlocked. On a
 *    non-jailbroken, passcode-set device this is meaningful protection.
 *  - The database itself is NOT separately encrypted, because `expo-sqlite`
 *    does not ship SQLCipher.
 *
 * To get true database-level encryption you need a dev build whose SQLite is
 * compiled with SQLCipher, then set `EXPO_PUBLIC_SQLCIPHER=1`. This module
 * manages the key for that case: a 256-bit random key generated once and kept
 * in the Keychain, applied via `PRAGMA key` before the first read.
 *
 * The guard matters — issuing `PRAGMA key` against a stock SQLite silently
 * does nothing, which would leave you believing the DB is encrypted when it
 * is not. So we only issue it when the build actually supports it.
 */
export function isSqlCipherEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SQLCIPHER === '1';
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Returns the database key, generating and persisting one on first run.
 * Losing this key means losing every un-uploaded photo, so it is written
 * before it is ever used to open the database.
 */
export async function getDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DB_KEY_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (existing) return existing;

  const key = toHex(Crypto.getRandomBytes(32));
  await SecureStore.setItemAsync(DB_KEY_NAME, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  logger.info('db.encryption.key_generated');
  return key;
}

/** SQL to run immediately after opening, before any other statement. */
export async function encryptionPragmas(): Promise<string[]> {
  if (!isSqlCipherEnabled()) return [];
  const key = await getDatabaseKey();
  return [`PRAGMA key = "x'${key}'"`, 'PRAGMA cipher_memory_security = ON'];
}
