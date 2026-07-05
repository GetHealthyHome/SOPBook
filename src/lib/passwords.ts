/**
 * Server-only password hashing.
 *
 * New hashes use scrypt with a random per-user salt, stored as
 * `scrypt$<salt-hex>$<hash-hex>`. Legacy hashes (unsalted-per-user
 * SHA-256, 64 hex chars) are still verifiable so existing accounts
 * keep working; callers should re-hash on successful login via
 * `needsRehash`.
 */
import crypto from 'crypto';

const LEGACY_SALT = 'sop_auth_salt_2026_v1';
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 32;

export const MAX_PASSWORD_LEN = 256;

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function legacySha256(password: string): string {
  return crypto.createHash('sha256').update(LEGACY_SALT + password).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || password.length > MAX_PASSWORD_LEN) return false;
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS).toString('hex');
    return safeEqualHex(candidate, hash);
  }
  // Legacy format: SHA-256(SALT + password) as 64 hex chars
  return safeEqualHex(legacySha256(password), stored);
}

export function needsRehash(stored: string): boolean {
  return !stored.startsWith('scrypt$');
}
