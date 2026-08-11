import * as Crypto from 'expo-crypto';

/**
 * UUIDv4 for locally-created records. These are generated on-device while
 * offline and become the attachment file name, so they must not collide across
 * devices — a counter or timestamp would.
 */
export function newId(): string {
  return Crypto.randomUUID();
}
