import * as SQLite from 'expo-sqlite';
import { encryptionPragmas, isSqlCipherEnabled } from './encryption';
import { LATEST_VERSION, MIGRATIONS } from './schema';
import { logger } from '@/utils/logger';

const DATABASE_NAME = 'retrofit-field.db';

let database: SQLite.SQLiteDatabase | null = null;
/** Held so concurrent first-callers await one open rather than racing three. */
let openPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  for (const pragma of await encryptionPragmas()) {
    await db.execAsync(pragma);
  }

  // WAL is what lets the sync worker write queue rows while the UI reads the
  // photo list, instead of the two serializing behind a global write lock.
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  await migrate(db);

  logger.info('db.opened', { version: LATEST_VERSION, sqlcipher: isSqlCipherEnabled() });
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= LATEST_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    // Each migration is one transaction: it either lands whole or not at all,
    // so a crash mid-upgrade cannot leave a half-built schema behind.
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
    });
    // PRAGMA user_version cannot be parameterized and must run outside the
    // transaction above to be durable against a rollback of a later migration.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    logger.info('db.migrated', { version: migration.version, name: migration.name });
  }
}

/** The single handle every repository uses. Safe to call from anywhere. */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  if (!openPromise) {
    openPromise = openAndMigrate()
      .then((db) => {
        database = db;
        return db;
      })
      .catch((error) => {
        openPromise = null; // let a later caller retry a failed open
        throw error;
      });
  }
  return openPromise;
}

/** Test/teardown helper. Not used by app code. */
export async function closeDatabase(): Promise<void> {
  if (!database) return;
  await database.closeAsync();
  database = null;
  openPromise = null;
}

/** Runs `fn` inside a transaction on the shared handle. */
export async function withTransaction<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDatabase();
  let result: T;
  await db.withTransactionAsync(async () => {
    result = await fn(db);
  });
  return result!;
}

/** Parses a JSON column, falling back rather than throwing on corrupt rows. */
export function parseJsonColumn<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    logger.warn('db.json_column.corrupt', { value: value.slice(0, 64) });
    return fallback;
  }
}
