jest.mock('expo-sqlite', () => require('@/test/sqliteDatabase'));

import { getDatabase } from '@/db/database';
import { photosRepo, uploadQueueRepo } from '@/db';
import { PARKED_UNTIL } from '@/sync/backoff';
import { makePhoto, resetDatabase } from '@/test/dbHarness';

beforeEach(async () => {
  await resetDatabase();
});

/** Reads a task straight from SQL, bypassing the repository's own accessors. */
async function readTask(photoId: string) {
  const db = await getDatabase();
  return db.getFirstAsync<{
    id: string;
    status: string;
    attempts: number;
    next_attempt_at: number;
    last_error: string | null;
  }>('SELECT * FROM upload_queue WHERE photo_id = ?', [photoId]);
}

describe('enqueuePhoto', () => {
  it('creates one task per photo', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);

    const tasks = await uploadQueueRepo.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ photoId: photo.id, status: 'pending', attempts: 0 });
  });

  it('is idempotent, so a double-tapped Retry cannot upload twice', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);

    expect(await uploadQueueRepo.listTasks()).toHaveLength(1);
  });

  it('revives a parked task, clearing its attempts and its error', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    const task = await uploadQueueRepo.claimNextTask();
    await uploadQueueRepo.markTaskFailed(task!.id, 'HTTP 500', PARKED_UNTIL);

    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);

    const row = await readTask(photo.id);
    expect(row).toMatchObject({ status: 'pending', attempts: 0, next_attempt_at: 0, last_error: null });
  });
});

describe('claimNextTask', () => {
  it('flips the claimed task to uploading in the same breath as reading it', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);

    const claimed = await uploadQueueRepo.claimNextTask();
    expect(claimed).toMatchObject({ photoId: photo.id, status: 'uploading' });
    expect(await readTask(photo.id)).toMatchObject({ status: 'uploading' });
  });

  it('never hands the same task to a second caller', async () => {
    // The failure this prevents: a connectivity tick and a manual "Sync now"
    // both claiming one task, and Housecall Pro growing a duplicate attachment.
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);

    const first = await uploadQueueRepo.claimNextTask();
    const second = await uploadQueueRepo.claimNextTask();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('claims in queue order, oldest due task first', async () => {
    const older = await makePhoto({ localUri: 'file:///photos/a.jpg' });
    const newer = await makePhoto({ localUri: 'file:///photos/b.jpg' });
    await uploadQueueRepo.enqueuePhoto(older.id, older.jobId);
    await uploadQueueRepo.enqueuePhoto(newer.id, newer.jobId);

    const db = await getDatabase();
    await db.runAsync("UPDATE upload_queue SET created_at = '2026-01-01T00:00:00.000Z' WHERE photo_id = ?", [
      older.id,
    ]);

    expect((await uploadQueueRepo.claimNextTask())?.photoId).toBe(older.id);
  });

  it('leaves a failed task alone until its backoff expires', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    const task = await uploadQueueRepo.claimNextTask();
    await uploadQueueRepo.markTaskFailed(task!.id, 'HTTP 503', Date.now() + 60_000);

    expect(await uploadQueueRepo.claimNextTask()).toBeNull();
    // ...and is eligible again once that moment passes.
    expect(await uploadQueueRepo.claimNextTask(Date.now() + 61_000)).not.toBeNull();
  });

  it('never claims a parked task', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    const task = await uploadQueueRepo.claimNextTask();
    await uploadQueueRepo.markTaskFailed(task!.id, 'Local file is missing', PARKED_UNTIL);

    expect(await uploadQueueRepo.claimNextTask(PARKED_UNTIL - 1)).toBeNull();
  });
});

describe('markTaskFailed', () => {
  it('counts the attempt and records the reason', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    const task = await uploadQueueRepo.claimNextTask();

    await uploadQueueRepo.markTaskFailed(task!.id, 'HTTP 502 Bad Gateway', 1_000);

    expect(await readTask(photo.id)).toMatchObject({
      status: 'failed',
      attempts: 1,
      next_attempt_at: 1_000,
      last_error: 'HTTP 502 Bad Gateway',
    });
  });

  it('truncates a runaway error so one bad response cannot bloat the table', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    const task = await uploadQueueRepo.claimNextTask();

    await uploadQueueRepo.markTaskFailed(task!.id, 'x'.repeat(5_000), 0);

    expect((await readTask(photo.id))?.last_error).toHaveLength(500);
  });
});

describe('releaseTask', () => {
  it('returns a claim without spending an attempt', async () => {
    // Going offline mid-flight is not the task's fault. Counting it would let a
    // subway ride exhaust the retry budget of every queued photo.
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    const task = await uploadQueueRepo.claimNextTask();

    await uploadQueueRepo.releaseTask(task!.id);

    expect(await readTask(photo.id)).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('will not resurrect a task that already failed', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    const task = await uploadQueueRepo.claimNextTask();
    await uploadQueueRepo.markTaskFailed(task!.id, 'HTTP 500', PARKED_UNTIL);

    await uploadQueueRepo.releaseTask(task!.id);

    expect(await readTask(photo.id)).toMatchObject({ status: 'failed', next_attempt_at: PARKED_UNTIL });
  });
});

describe('recoverStuckTasks', () => {
  it('reclaims rows stranded by a process death', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    await uploadQueueRepo.claimNextTask();

    expect(await uploadQueueRepo.recoverStuckTasks()).toBe(1);
    expect(await readTask(photo.id)).toMatchObject({ status: 'pending' });
  });

  it('leaves a fresh claim alone when an age is given', async () => {
    // A background pass on Android can fire while the foreground app is
    // genuinely mid-upload. Reclaiming that row would let a second worker
    // claim it and post the photo twice.
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    await uploadQueueRepo.claimNextTask();

    expect(await uploadQueueRepo.recoverStuckTasks(10 * 60_000)).toBe(0);
    expect(await readTask(photo.id)).toMatchObject({ status: 'uploading' });
  });

  it('reclaims a claim older than the given age', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    await uploadQueueRepo.claimNextTask();

    const db = await getDatabase();
    await db.runAsync("UPDATE upload_queue SET updated_at = '2026-01-01T00:00:00.000Z' WHERE photo_id = ?", [
      photo.id,
    ]);

    expect(await uploadQueueRepo.recoverStuckTasks(10 * 60_000)).toBe(1);
    expect(await readTask(photo.id)).toMatchObject({ status: 'pending' });
  });
});

describe('retryAllFailed', () => {
  it('clears backoff and error on every failed task, including parked ones', async () => {
    const first = await makePhoto({ localUri: 'file:///photos/a.jpg' });
    const second = await makePhoto({ localUri: 'file:///photos/b.jpg' });
    for (const photo of [first, second]) {
      await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
      const task = await uploadQueueRepo.claimNextTask();
      await uploadQueueRepo.markTaskFailed(task!.id, 'HTTP 401', PARKED_UNTIL);
    }

    expect(await uploadQueueRepo.retryAllFailed()).toBe(2);
    expect(await readTask(first.id)).toMatchObject({ status: 'pending', next_attempt_at: 0, last_error: null });
    expect(await uploadQueueRepo.claimNextTask()).not.toBeNull();
  });
});

describe('counters', () => {
  it('reports one count per status for the sync bar', async () => {
    const a = await makePhoto({ localUri: 'file:///photos/a.jpg' });
    const b = await makePhoto({ localUri: 'file:///photos/b.jpg' });
    const c = await makePhoto({ localUri: 'file:///photos/c.jpg' });
    for (const photo of [a, b, c]) await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);

    const claimed = await uploadQueueRepo.claimNextTask();
    const failing = await uploadQueueRepo.claimNextTask();
    await uploadQueueRepo.markTaskFailed(failing!.id, 'HTTP 500', Date.now() + 60_000);

    expect(await uploadQueueRepo.getQueueCounts()).toEqual({ pending: 1, uploading: 1, failed: 1 });
    expect(claimed).not.toBeNull();
  });

  it('excludes parked tasks from the unfinished count', async () => {
    // The background scheduler reads this to decide whether to ask for another
    // slot. Counting parked photos would make it ask forever.
    const live = await makePhoto({ localUri: 'file:///photos/a.jpg' });
    const parked = await makePhoto({ localUri: 'file:///photos/b.jpg' });
    await uploadQueueRepo.enqueuePhoto(live.id, live.jobId);
    await uploadQueueRepo.enqueuePhoto(parked.id, parked.jobId);

    const db = await getDatabase();
    await db.runAsync('UPDATE upload_queue SET next_attempt_at = ? WHERE photo_id = ?', [
      PARKED_UNTIL,
      parked.id,
    ]);

    expect(await uploadQueueRepo.countUnfinishedTasks(PARKED_UNTIL)).toBe(1);
  });
});

describe('markTaskDone', () => {
  it('removes the row rather than keeping a history table nobody reads', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
    const task = await uploadQueueRepo.claimNextTask();

    await uploadQueueRepo.markTaskDone(task!.id);

    expect(await uploadQueueRepo.listTasks()).toHaveLength(0);
    // The photo itself survives — the queue row is bookkeeping, the photo is not.
    expect(await photosRepo.getPhoto(photo.id)).not.toBeNull();
  });
});
