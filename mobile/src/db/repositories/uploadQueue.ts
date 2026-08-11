import { getDatabase, withTransaction } from '../database';
import { newId } from '@/utils/id';
import type { SyncSummary, UploadTask, UploadTaskStatus } from '@/types';

interface QueueRow {
  id: string;
  photo_id: string;
  job_id: string;
  status: string;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function toTask(row: QueueRow): UploadTask {
  return {
    id: row.id,
    photoId: row.photo_id,
    jobId: row.job_id,
    status: row.status as UploadTaskStatus,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Enqueues a photo, or resets an existing task back to `pending`.
 *
 * The `ON CONFLICT` arm is what makes "Retry" idempotent: the unique index on
 * `photo_id` means a second enqueue updates the existing task instead of
 * creating a duplicate that would upload the same image twice.
 */
export async function enqueuePhoto(photoId: string, jobId: string): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO upload_queue (
       id, photo_id, job_id, status, attempts, next_attempt_at, last_error, created_at, updated_at
     ) VALUES (?, ?, ?, 'pending', 0, 0, NULL, ?, ?)
     ON CONFLICT(photo_id) DO UPDATE SET
       status = 'pending',
       attempts = 0,
       next_attempt_at = 0,
       last_error = NULL,
       updated_at = excluded.updated_at`,
    [newId(), photoId, jobId, now, now],
  );
}

/**
 * Atomically claims the next task that is due, flipping it to `uploading` in
 * the same transaction as the select.
 *
 * Doing it in one transaction is the point. Select-then-update would let a
 * connectivity-change tick and a manual "Sync now" tap both claim the same
 * task and post the photo twice — Housecall Pro would happily create two
 * attachments and the tech would see a duplicate on the job.
 *
 * `failed` tasks are eligible again once their backoff expires; only tasks the
 * worker has explicitly parked (next_attempt_at set to Infinity-ish) stay out.
 */
export async function claimNextTask(now = Date.now()): Promise<UploadTask | null> {
  return withTransaction(async (db) => {
    const row = await db.getFirstAsync<QueueRow>(
      `SELECT * FROM upload_queue
       WHERE status IN ('pending', 'failed') AND next_attempt_at <= ?
       ORDER BY next_attempt_at ASC, created_at ASC
       LIMIT 1`,
      [now],
    );
    if (!row) return null;

    await db.runAsync(
      `UPDATE upload_queue SET status = 'uploading', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), row.id],
    );

    return toTask({ ...row, status: 'uploading' });
  });
}

export async function markTaskDone(taskId: string): Promise<void> {
  const db = await getDatabase();
  // Rows are deleted rather than kept as `done`: the photo row already records
  // the outcome, and an unbounded history table on a device that takes 80
  // photos a day is just a slow leak.
  await db.runAsync('DELETE FROM upload_queue WHERE id = ?', [taskId]);
}

export async function markTaskFailed(
  taskId: string,
  error: string,
  nextAttemptAt: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE upload_queue
     SET status = 'failed',
         attempts = attempts + 1,
         next_attempt_at = ?,
         last_error = ?,
         updated_at = ?
     WHERE id = ?`,
    [nextAttemptAt, error.slice(0, 500), new Date().toISOString(), taskId],
  );
}

/**
 * Returns a claimed task to `pending` without counting an attempt — used when
 * the worker aborts for a reason that is not the task's fault (connectivity
 * dropped, app backgrounded mid-upload).
 */
export async function releaseTask(taskId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE upload_queue SET status = 'pending', updated_at = ? WHERE id = ? AND status = 'uploading'`,
    [new Date().toISOString(), taskId],
  );
}

/**
 * Recovers tasks left `uploading` by a process death. Without it, a force-quit
 * mid-upload strands that photo forever, because no claim query will ever look
 * at an `uploading` row again.
 *
 * `staleMs` is what makes this safe to call from more than one place. At
 * startup nothing else can be uploading, so the default of 0 sweeps every row.
 * A background pass must instead pass a generous age, because on Android it can
 * fire while the foreground app is genuinely mid-upload — resetting that row
 * would let a second worker claim it and post the photo twice.
 *
 * Comparing `updated_at` lexicographically is sound here: every writer uses
 * `toISOString()`, whose fixed-width UTC format sorts chronologically.
 */
export async function recoverStuckTasks(staleMs = 0): Promise<number> {
  const db = await getDatabase();
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  const result = await db.runAsync(
    `UPDATE upload_queue
     SET status = 'pending', updated_at = ?
     WHERE status = 'uploading' AND updated_at <= ?`,
    [new Date().toISOString(), cutoff],
  );
  return result.changes ?? 0;
}

export async function listTasks(): Promise<UploadTask[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QueueRow>(
    'SELECT * FROM upload_queue ORDER BY created_at ASC',
  );
  return rows.map(toTask);
}

/** Clears backoff on every failed task so a manual "Retry all" fires now. */
export async function retryAllFailed(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `UPDATE upload_queue
     SET status = 'pending', next_attempt_at = 0, last_error = NULL, updated_at = ?
     WHERE status = 'failed'`,
    [new Date().toISOString()],
  );
  return result.changes ?? 0;
}

export async function removeTaskForPhoto(photoId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM upload_queue WHERE photo_id = ?', [photoId]);
}

/**
 * Tasks that still have a future attempt coming, ignoring parked ones.
 *
 * A background pass reports this to the OS scheduler: "still work to do" is
 * what earns the app another slot. Counting parked tasks here would make the
 * app ask for slots forever over photos that can never succeed.
 */
export async function countUnfinishedTasks(parkedUntil: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM upload_queue WHERE next_attempt_at < ?',
    [parkedUntil],
  );
  return row?.count ?? 0;
}

/** One query behind the sync status bar, so the bar is never N queries deep. */
export async function getQueueCounts(): Promise<Pick<SyncSummary, 'pending' | 'uploading' | 'failed'>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ status: string; count: number }>(
    'SELECT status, COUNT(*) AS count FROM upload_queue GROUP BY status',
  );

  const counts = { pending: 0, uploading: 0, failed: 0 };
  for (const row of rows) {
    if (row.status === 'pending') counts.pending = row.count;
    else if (row.status === 'uploading') counts.uploading = row.count;
    else if (row.status === 'failed') counts.failed = row.count;
  }
  return counts;
}
