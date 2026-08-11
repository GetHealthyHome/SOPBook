/**
 * SQLite schema, expressed as an ordered list of migrations.
 *
 * Rules for changing this file:
 *  - Never edit a shipped migration. Append a new one. Field devices carry
 *    unsynced photos, and rewriting history is how you lose them.
 *  - Every migration must be idempotent-safe under `IF NOT EXISTS` where the
 *    statement supports it, because a crash mid-migration re-runs the batch.
 *
 * Modeling notes:
 *  - `jobs` and `customers` are a *cache* of Housecall Pro. They can be dropped
 *    and refetched. Nothing the tech creates lives there.
 *  - `photos` and `upload_queue` are the *source of truth*. They hold work that
 *    exists nowhere else until it uploads, so they are never cleared wholesale.
 *  - Tags are stored as a JSON array in a TEXT column rather than a join table.
 *    A photo has a handful of tags, we never query "all photos with tag X"
 *    across the whole DB, and a join table would triple the write cost of the
 *    hot path (saving a photo in an attic with no signal).
 */

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS customers (
        id             TEXT PRIMARY KEY NOT NULL,
        display_name   TEXT NOT NULL,
        first_name     TEXT,
        last_name      TEXT,
        company        TEXT,
        email          TEXT,
        phone          TEXT,
        address_json   TEXT,
        tags_json      TEXT NOT NULL DEFAULT '[]',
        notes          TEXT,
        updated_at     TEXT,
        -- Lowercased "name address email phone" blob. Offline search is a
        -- LIKE against this one column instead of five OR'd comparisons.
        search_blob    TEXT NOT NULL DEFAULT '',
        cached_at      TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_customers_search ON customers (search_blob)`,

      `CREATE TABLE IF NOT EXISTS jobs (
        id                    TEXT PRIMARY KEY NOT NULL,
        reference             TEXT NOT NULL,
        description           TEXT,
        status                TEXT NOT NULL,
        raw_status            TEXT NOT NULL,
        customer_id           TEXT,
        customer_name         TEXT,
        address_json          TEXT,
        scheduled_start       TEXT,
        scheduled_end         TEXT,
        job_type              TEXT,
        assigned_names_json   TEXT NOT NULL DEFAULT '[]',
        total_amount_cents    INTEGER,
        updated_at            TEXT,
        search_blob           TEXT NOT NULL DEFAULT '',
        cached_at             TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON jobs (scheduled_start)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs (customer_id)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs (search_blob)`,

      `CREATE TABLE IF NOT EXISTS photos (
        id                    TEXT PRIMARY KEY NOT NULL,
        job_id                TEXT NOT NULL,
        local_uri             TEXT NOT NULL,
        byte_size             INTEGER,
        width                 INTEGER,
        height                INTEGER,
        -- Full CaptureMetadata. Denormalized on purpose: it is written once,
        -- read as a unit, and must survive schema drift in the stamp format.
        metadata_json         TEXT NOT NULL,
        tags_json             TEXT NOT NULL DEFAULT '[]',
        caption               TEXT,
        status                TEXT NOT NULL,
        remote_attachment_id  TEXT,
        created_at            TEXT NOT NULL,
        updated_at            TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_photos_job ON photos (job_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_photos_status ON photos (status)`,

      `CREATE TABLE IF NOT EXISTS upload_queue (
        id                TEXT PRIMARY KEY NOT NULL,
        photo_id          TEXT NOT NULL,
        job_id            TEXT NOT NULL,
        status            TEXT NOT NULL,
        attempts          INTEGER NOT NULL DEFAULT 0,
        -- Epoch ms. The worker claims tasks with next_attempt_at <= now.
        next_attempt_at   INTEGER NOT NULL DEFAULT 0,
        last_error        TEXT,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL,
        FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
      )`,
      // One live task per photo. This constraint, not application logic, is
      // what stops a double-tap on "Retry" from uploading the same photo twice.
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_upload_queue_photo ON upload_queue (photo_id)`,
      `CREATE INDEX IF NOT EXISTS idx_upload_queue_claim ON upload_queue (status, next_attempt_at)`,

      `CREATE TABLE IF NOT EXISTS meta (
        key    TEXT PRIMARY KEY NOT NULL,
        value  TEXT
      )`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce(
  (max, migration) => Math.max(max, migration.version),
  0,
);
