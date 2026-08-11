jest.mock('expo-sqlite', () => require('@/test/sqliteDatabase'));

import { getDatabase } from '@/db/database';
import { LATEST_VERSION } from '@/db/schema';
import { photosRepo, uploadQueueRepo } from '@/db';
import { SAMPLE_METADATA, makePhoto, resetDatabase } from '@/test/dbHarness';

beforeEach(async () => {
  await resetDatabase();
});

describe('migrations', () => {
  it('brings a blank database up to the current version', async () => {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(LATEST_VERSION);
  });

  it('creates every table the repositories read', async () => {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const names = rows.map((row) => row.name);
    expect(names).toEqual(expect.arrayContaining(['customers', 'jobs', 'photos', 'upload_queue', 'meta']));
  });

  it('enforces one queue task per photo at the database level', async () => {
    // Application logic is not what stops a double upload — this index is.
    const photo = await makePhoto();
    const db = await getDatabase();
    const insert = `INSERT INTO upload_queue (id, photo_id, job_id, status, attempts, next_attempt_at, created_at, updated_at)
                    VALUES (?, ?, ?, 'pending', 0, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`;

    await db.runAsync(insert, ['task_a', photo.id, photo.jobId]);
    await expect(db.runAsync(insert, ['task_b', photo.id, photo.jobId])).rejects.toThrow(/UNIQUE/i);
  });
});

describe('createPhoto', () => {
  it('round-trips metadata and tags through their JSON columns', async () => {
    const created = await photosRepo.createPhoto({
      jobId: 'job_7',
      localUri: 'file:///photos/attic.jpg',
      metadata: SAMPLE_METADATA,
      tags: ['Attic Insulation', 'Air Sealing'],
      caption: 'R-49 blown in over the hatch',
      byteSize: 1_240_000,
      width: 2560,
      height: 1920,
    });

    const loaded = await photosRepo.getPhoto(created.id);
    expect(loaded).toMatchObject({
      jobId: 'job_7',
      localUri: 'file:///photos/attic.jpg',
      tags: ['Attic Insulation', 'Air Sealing'],
      caption: 'R-49 blown in over the hatch',
      byteSize: 1_240_000,
      status: 'draft',
    });
    expect(loaded?.metadata.location?.latitude).toBeCloseTo(40.016667, 6);
  });

  it('defaults to draft, because a photo is not queueable until it is saved', async () => {
    const photo = await photosRepo.createPhoto({
      jobId: 'job_7',
      localUri: 'file:///photos/a.jpg',
      metadata: SAMPLE_METADATA,
    });
    expect(photo.status).toBe('draft');
  });

  it('survives a corrupt metadata column rather than dropping the row', async () => {
    // A photo whose metadata will not parse is still a photo worth uploading.
    const photo = await makePhoto();
    const db = await getDatabase();
    await db.runAsync('UPDATE photos SET metadata_json = ? WHERE id = ?', ['{not json', photo.id]);

    const loaded = await photosRepo.getPhoto(photo.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.metadata.timeZone).toBe('UTC');
  });
});

describe('updatePhoto', () => {
  it('touches only the columns it was given', async () => {
    const photo = await makePhoto({ tags: ['HVAC'] });
    await photosRepo.updatePhoto(photo.id, { status: 'uploaded', remoteAttachmentId: 'att_9' });

    const loaded = await photosRepo.getPhoto(photo.id);
    expect(loaded).toMatchObject({
      status: 'uploaded',
      remoteAttachmentId: 'att_9',
      tags: ['HVAC'],
      localUri: photo.localUri,
    });
  });

  it('is a no-op when given nothing, instead of emitting broken SQL', async () => {
    const photo = await makePhoto();
    await expect(photosRepo.updatePhoto(photo.id, {})).resolves.toBeUndefined();
  });

  it('can clear a caption', async () => {
    const photo = await makePhoto();
    await photosRepo.updatePhoto(photo.id, { caption: 'first' });
    await photosRepo.updatePhoto(photo.id, { caption: null });
    expect((await photosRepo.getPhoto(photo.id))?.caption).toBeUndefined();
  });
});

describe('deletePhoto', () => {
  it('takes the queue task with it, so no worker claims an orphan', async () => {
    const photo = await makePhoto();
    await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);

    await photosRepo.deletePhoto(photo.id);

    expect(await photosRepo.getPhoto(photo.id)).toBeNull();
    expect(await uploadQueueRepo.listTasks()).toHaveLength(0);
  });
});

describe('listing', () => {
  it('returns a job\'s photos newest first', async () => {
    const first = await makePhoto({ jobId: 'job_a', localUri: 'file:///photos/1.jpg' });
    const second = await makePhoto({ jobId: 'job_a', localUri: 'file:///photos/2.jpg' });
    await makePhoto({ jobId: 'job_b', localUri: 'file:///photos/3.jpg' });

    const db = await getDatabase();
    await db.runAsync('UPDATE photos SET created_at = ? WHERE id = ?', ['2026-01-01T00:00:00.000Z', first.id]);
    await db.runAsync('UPDATE photos SET created_at = ? WHERE id = ?', ['2026-06-01T00:00:00.000Z', second.id]);

    const photos = await photosRepo.listPhotosForJob('job_a');
    expect(photos.map((photo) => photo.id)).toEqual([second.id, first.id]);
  });

  it('lists every referenced file for the orphan sweeper', async () => {
    await makePhoto({ localUri: 'file:///photos/1.jpg' });
    await makePhoto({ localUri: 'file:///photos/2.jpg' });

    expect((await photosRepo.listAllPhotoUris()).sort()).toEqual([
      'file:///photos/1.jpg',
      'file:///photos/2.jpg',
    ]);
  });

  it('finds abandoned drafts without touching anything queued', async () => {
    const stale = await makePhoto({ localUri: 'file:///photos/stale.jpg', status: 'draft' });
    const fresh = await makePhoto({ localUri: 'file:///photos/fresh.jpg', status: 'draft' });
    const queued = await makePhoto({ localUri: 'file:///photos/queued.jpg', status: 'pending' });

    const db = await getDatabase();
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await db.runAsync('UPDATE photos SET created_at = ? WHERE id IN (?, ?)', [old, stale.id, queued.id]);

    const drafts = await photosRepo.listStaleDrafts(24 * 60 * 60 * 1000);
    expect(drafts.map((photo) => photo.id)).toEqual([stale.id]);
    expect(drafts.map((photo) => photo.id)).not.toContain(fresh.id);
  });
});
