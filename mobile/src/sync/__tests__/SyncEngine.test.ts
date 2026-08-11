jest.mock('expo-sqlite', () => require('@/test/sqliteDatabase'));
jest.mock('@/api/housecallPro', () => ({ uploadJobAttachment: jest.fn() }));
jest.mock('@/storage/photoFiles', () => ({ fileExists: jest.fn(), deleteFile: jest.fn() }));
jest.mock('@/auth/credentials', () => ({ hasApiToken: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(), addEventListener: jest.fn() },
}));

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { ApiError } from '@/api/errors';
import { uploadJobAttachment } from '@/api/housecallPro';
import { hasApiToken } from '@/auth/credentials';
import { photosRepo, uploadQueueRepo } from '@/db';
import { getDatabase } from '@/db/database';
import { deleteFile, fileExists } from '@/storage/photoFiles';
import { syncEngine } from '@/sync/SyncEngine';
import { PARKED_UNTIL } from '@/sync/backoff';
import { makePhoto, resetDatabase } from '@/test/dbHarness';

const mockUpload = uploadJobAttachment as jest.MockedFunction<typeof uploadJobAttachment>;
const mockFileExists = fileExists as jest.MockedFunction<typeof fileExists>;
const mockDeleteFile = deleteFile as jest.MockedFunction<typeof deleteFile>;
const mockHasToken = hasApiToken as jest.MockedFunction<typeof hasApiToken>;
const mockNetInfo = NetInfo as unknown as {
  fetch: jest.Mock<Promise<NetInfoState>, []>;
  addEventListener: jest.Mock;
};

const ONLINE = { isConnected: true, isInternetReachable: true } as NetInfoState;
const OFFLINE = { isConnected: false, isInternetReachable: false } as NetInfoState;

/** Connectivity callbacks the engine registered, so a test can flip the network. */
let netListeners: ((state: NetInfoState) => void)[] = [];

beforeEach(async () => {
  jest.clearAllMocks();
  netListeners = [];

  mockNetInfo.fetch.mockResolvedValue(ONLINE);
  mockNetInfo.addEventListener.mockImplementation((listener: (state: NetInfoState) => void) => {
    netListeners.push(listener);
    return () => undefined;
  });
  mockHasToken.mockResolvedValue(true);
  mockFileExists.mockResolvedValue(true);
  mockDeleteFile.mockResolvedValue(undefined);
  mockUpload.mockResolvedValue({ id: 'att_1' } as Awaited<ReturnType<typeof uploadJobAttachment>>);

  await resetDatabase();
});

afterEach(() => {
  syncEngine.stop();
});

async function queuedPhoto(overrides: Parameters<typeof makePhoto>[0] = {}) {
  const photo = await makePhoto(overrides);
  await uploadQueueRepo.enqueuePhoto(photo.id, photo.jobId);
  return photo;
}

async function readTask(photoId: string) {
  const db = await getDatabase();
  return db.getFirstAsync<{ status: string; attempts: number; next_attempt_at: number }>(
    'SELECT * FROM upload_queue WHERE photo_id = ?',
    [photoId],
  );
}

describe('a successful upload', () => {
  it('marks the photo uploaded, clears the task, and reclaims the disk', async () => {
    const photo = await queuedPhoto();

    await syncEngine.requestDrain();

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(await photosRepo.getPhoto(photo.id)).toMatchObject({
      status: 'uploaded',
      remoteAttachmentId: 'att_1',
    });
    expect(await uploadQueueRepo.listTasks()).toHaveLength(0);
    // The bytes are safe upstream; keeping them is what fills a 64 GB phone.
    expect(mockDeleteFile).toHaveBeenCalledWith(photo.localUri);
  });

  it('drains the whole backlog in one pass', async () => {
    await queuedPhoto({ localUri: 'file:///photos/1.jpg' });
    await queuedPhoto({ localUri: 'file:///photos/2.jpg' });
    await queuedPhoto({ localUri: 'file:///photos/3.jpg' });

    await syncEngine.requestDrain();

    expect(mockUpload).toHaveBeenCalledTimes(3);
    expect(await uploadQueueRepo.listTasks()).toHaveLength(0);
  });

  it('uploads each photo exactly once even when two drains overlap', async () => {
    // The real trigger: a connectivity event and a manual "Sync now" landing
    // together. A duplicate here becomes a duplicate attachment on the job.
    await queuedPhoto({ localUri: 'file:///photos/1.jpg' });
    await queuedPhoto({ localUri: 'file:///photos/2.jpg' });

    await Promise.all([syncEngine.requestDrain(), syncEngine.requestDrain()]);

    expect(mockUpload).toHaveBeenCalledTimes(2);
  });
});

describe('a retryable failure', () => {
  it('counts the attempt and schedules a future one', async () => {
    const photo = await queuedPhoto();
    mockUpload.mockRejectedValue(new ApiError('Bad Gateway', 502));

    await syncEngine.requestDrain();

    const task = await readTask(photo.id);
    expect(task).toMatchObject({ status: 'failed', attempts: 1 });
    expect(task!.next_attempt_at).toBeGreaterThan(Date.now());
    expect(task!.next_attempt_at).toBeLessThan(PARKED_UNTIL);
    // Back to pending, not failed — the photo is fine, the network was not.
    expect(await photosRepo.getPhoto(photo.id)).toMatchObject({ status: 'pending' });
  });

  it('parks the task once the retry budget is spent', async () => {
    const photo = await queuedPhoto();
    mockUpload.mockRejectedValue(new ApiError('Service Unavailable', 503));

    const db = await getDatabase();
    await db.runAsync('UPDATE upload_queue SET attempts = 7 WHERE photo_id = ?', [photo.id]);

    await syncEngine.requestDrain();

    expect(await readTask(photo.id)).toMatchObject({ status: 'failed', next_attempt_at: PARKED_UNTIL });
    expect(await photosRepo.getPhoto(photo.id)).toMatchObject({ status: 'failed' });
  });
});

describe('an unrecoverable failure', () => {
  it('parks a bad credential immediately instead of retrying eight times', async () => {
    const photo = await queuedPhoto();
    mockUpload.mockRejectedValue(new ApiError('Unauthorized', 401));

    await syncEngine.requestDrain();

    expect(await readTask(photo.id)).toMatchObject({
      status: 'failed',
      attempts: 1,
      next_attempt_at: PARKED_UNTIL,
    });
    expect(await photosRepo.getPhoto(photo.id)).toMatchObject({ status: 'failed' });
  });

  it('parks a photo whose file has vanished, without calling the API', async () => {
    const photo = await queuedPhoto();
    mockFileExists.mockResolvedValue(false);

    await syncEngine.requestDrain();

    expect(mockUpload).not.toHaveBeenCalled();
    expect(await readTask(photo.id)).toMatchObject({ next_attempt_at: PARKED_UNTIL });
    expect(await photosRepo.getPhoto(photo.id)).toMatchObject({ status: 'failed' });
  });
});

describe('losing connectivity mid-upload', () => {
  it('returns the task to the queue without spending an attempt', async () => {
    // A subway ride must not exhaust the retry budget of every queued photo.
    const photo = await queuedPhoto();
    // The connection drops while the request is in flight, exactly as NetInfo
    // would report it — so this has to be armed before the engine drains.
    mockUpload.mockImplementation(async () => {
      for (const listener of netListeners) listener(OFFLINE);
      throw new ApiError('Network request failed', 0);
    });

    await syncEngine.start();

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(await readTask(photo.id)).toMatchObject({ status: 'pending', attempts: 0 });
    expect(await photosRepo.getPhoto(photo.id)).toMatchObject({ status: 'pending' });
  });
});

describe('inconsistent state left by a crash', () => {
  it('drops a task whose photo the tech deleted', async () => {
    const photo = await queuedPhoto();
    const db = await getDatabase();
    // Delete the photo row only, leaving the task behind.
    await db.runAsync('DELETE FROM photos WHERE id = ?', [photo.id]);

    await syncEngine.requestDrain();

    expect(mockUpload).not.toHaveBeenCalled();
    expect(await uploadQueueRepo.listTasks()).toHaveLength(0);
  });

  it('does not re-upload a photo that already made it upstream', async () => {
    // The crash window: the upload succeeded but the queue row outlived it.
    const photo = await queuedPhoto();
    await photosRepo.updatePhoto(photo.id, { status: 'uploaded', remoteAttachmentId: 'att_existing' });

    await syncEngine.requestDrain();

    expect(mockUpload).not.toHaveBeenCalled();
    expect(await uploadQueueRepo.listTasks()).toHaveLength(0);
  });

  it('recovers rows stranded in uploading by a force-quit', async () => {
    const photo = await queuedPhoto();
    await uploadQueueRepo.claimNextTask();
    expect(await readTask(photo.id)).toMatchObject({ status: 'uploading' });

    await syncEngine.start();

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(await uploadQueueRepo.listTasks()).toHaveLength(0);
  });
});

describe('a headless background pass', () => {
  it('uploads and reports nothing left', async () => {
    await queuedPhoto();

    const result = await syncEngine.runHeadlessPass();

    expect(result).toEqual({ uploaded: 1, remaining: 0 });
  });

  it('declines without a credential, leaving the queue untouched', async () => {
    // Every upload would be a guaranteed 401, and each one would burn a retry
    // attempt on a photo that is otherwise perfectly fine.
    const photo = await queuedPhoto();
    mockHasToken.mockResolvedValue(false);

    const result = await syncEngine.runHeadlessPass();

    expect(result).toMatchObject({ uploaded: 0, remaining: 1, skipped: 'no-credential' });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(await readTask(photo.id)).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('declines when the device is offline', async () => {
    await queuedPhoto();
    mockNetInfo.fetch.mockResolvedValue(OFFLINE);

    const result = await syncEngine.runHeadlessPass();

    expect(result).toMatchObject({ uploaded: 0, remaining: 1, skipped: 'offline' });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('stops when its wall-clock budget runs out and says work remains', async () => {
    // Overrunning gets the process killed mid-upload; stopping early keeps the
    // queue consistent, and `remaining` is what earns the next slot.
    await queuedPhoto({ localUri: 'file:///photos/1.jpg' });
    await queuedPhoto({ localUri: 'file:///photos/2.jpg' });
    await queuedPhoto({ localUri: 'file:///photos/3.jpg' });

    const result = await syncEngine.runHeadlessPass({ maxTasks: 1 });

    expect(result.uploaded).toBe(1);
    expect(result.remaining).toBe(2);
  });

  it('reports remaining work when uploads keep failing', async () => {
    await queuedPhoto();
    mockUpload.mockRejectedValue(new ApiError('Bad Gateway', 502));

    const result = await syncEngine.runHeadlessPass();

    expect(result).toMatchObject({ uploaded: 0, remaining: 1 });
  });

  it('does not count parked photos as remaining', async () => {
    await queuedPhoto();
    mockUpload.mockRejectedValue(new ApiError('Unauthorized', 401));

    const result = await syncEngine.runHeadlessPass();

    expect(result).toEqual({ uploaded: 0, remaining: 0 });
  });
});
