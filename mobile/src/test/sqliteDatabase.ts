import { DatabaseSync } from 'node:sqlite';

/**
 * A stand-in for `expo-sqlite` backed by Node's own SQLite.
 *
 * Hand-mocking each repository function would only test the mocks. The queue's
 * correctness lives in its SQL: an atomic claim, a unique index that makes
 * re-enqueueing idempotent, an ordering that decides which photo uploads next.
 * None of that is exercised unless a real engine parses and runs the
 * statements, against the real migrations.
 *
 * `node:sqlite` rather than `sql.js`: WebAssembly modules misbehave inside
 * Jest's VM sandbox, where typed arrays cross a realm boundary and string
 * decoding silently returns empty — which surfaces as SQLite failing to open a
 * database with an empty error message. Node's binding has no such problem, and
 * needs no native build step either.
 *
 * Requires Node 22.5+ for `node:sqlite`.
 */

/** The `expo-sqlite` value types this app actually binds. */
type BindValue = string | number | null | undefined | boolean | Uint8Array;
type Bindable = string | number | null | Uint8Array;

function toBindable(params: BindValue[]): Bindable[] {
  return params.map((value) => {
    // `expo-sqlite` treats both as SQL NULL; `node:sqlite` throws on either.
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

/**
 * Implements the slice of `SQLiteDatabase` this app uses. Deliberately not the
 * whole surface — an unimplemented method should fail loudly in a test rather
 * than quietly return a plausible-looking nothing.
 */
class NodeSqliteAdapter {
  constructor(private readonly db: DatabaseSync) {}

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async runAsync(
    source: string,
    params: BindValue[] = [],
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.db.prepare(source).run(...toBindable(params));
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getAllAsync<T>(source: string, params: BindValue[] = []): Promise<T[]> {
    return this.db.prepare(source).all(...toBindable(params)) as T[];
  }

  async getFirstAsync<T>(source: string, params: BindValue[] = []): Promise<T | null> {
    return (this.db.prepare(source).get(...toBindable(params)) as T | undefined) ?? null;
  }

  /**
   * Non-reentrant, exactly like the real thing. A nested call hits SQLite's
   * "cannot start a transaction within a transaction", which is the behaviour a
   * test should see if app code ever nests them.
   */
  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

/**
 * Opens a fresh in-memory database. The name is ignored: every call is a new
 * database, so tests cannot leak rows into each other.
 */
export async function openDatabaseAsync(_name: string): Promise<NodeSqliteAdapter> {
  return new NodeSqliteAdapter(new DatabaseSync(':memory:'));
}
