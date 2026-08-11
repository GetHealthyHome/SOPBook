/**
 * `expo-crypto`'s Jest mock returns `undefined` from `randomUUID()`, which
 * turns every locally-created row into a NOT NULL violation on its primary key
 * — a failure about the mock, not about the code under test. Node's own
 * implementation is a faithful stand-in for both functions this app uses.
 */
/**
 * The app logs freely by design. Under test that buries assertion failures in
 * `db.migrated` lines, so the sink is silenced — spy on `logger` directly if a
 * test ever needs to assert on what was logged.
 */
jest.mock('@/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomBytes: (length) => new Uint8Array(nodeCrypto.randomBytes(length)),
    getRandomBytesAsync: async (length) => new Uint8Array(nodeCrypto.randomBytes(length)),
  };
});
