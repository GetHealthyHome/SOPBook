import { getDatabase, parseJsonColumn, withTransaction } from '../database';
import { newId } from '@/utils/id';
import type { CaptureMetadata, Photo, PhotoSyncStatus, PhotoTag } from '@/types';

interface PhotoRow {
  id: string;
  job_id: string;
  local_uri: string;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  metadata_json: string;
  tags_json: string;
  caption: string | null;
  status: string;
  remote_attachment_id: string | null;
  created_at: string;
  updated_at: string;
}

function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    jobId: row.job_id,
    localUri: row.local_uri,
    byteSize: row.byte_size ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    // A photo without parseable metadata is still a photo worth uploading, so
    // the fallback keeps the row usable rather than dropping it.
    metadata: parseJsonColumn<CaptureMetadata>(row.metadata_json, {
      capturedAtUtc: row.created_at,
      capturedAtLocal: row.created_at,
      timeZone: 'UTC',
      orientation: 'portrait',
      appVersion: 'unknown',
    }),
    tags: parseJsonColumn<PhotoTag[]>(row.tags_json, []),
    caption: row.caption ?? undefined,
    status: row.status as PhotoSyncStatus,
    remoteAttachmentId: row.remote_attachment_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreatePhotoInput {
  jobId: string;
  localUri: string;
  metadata: CaptureMetadata;
  tags?: PhotoTag[];
  caption?: string;
  byteSize?: number;
  width?: number;
  height?: number;
  /** `draft` while the tech is still annotating; `pending` once they save. */
  status?: PhotoSyncStatus;
}

export async function createPhoto(input: CreatePhotoInput): Promise<Photo> {
  const now = new Date().toISOString();
  const photo: Photo = {
    id: newId(),
    jobId: input.jobId,
    localUri: input.localUri,
    byteSize: input.byteSize,
    width: input.width,
    height: input.height,
    metadata: input.metadata,
    tags: input.tags ?? [],
    caption: input.caption,
    status: input.status ?? 'draft',
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO photos (
       id, job_id, local_uri, byte_size, width, height, metadata_json,
       tags_json, caption, status, remote_attachment_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      photo.id,
      photo.jobId,
      photo.localUri,
      photo.byteSize ?? null,
      photo.width ?? null,
      photo.height ?? null,
      JSON.stringify(photo.metadata),
      JSON.stringify(photo.tags),
      photo.caption ?? null,
      photo.status,
      photo.createdAt,
      photo.updatedAt,
    ],
  );

  return photo;
}

export interface UpdatePhotoInput {
  localUri?: string;
  tags?: PhotoTag[];
  caption?: string | null;
  status?: PhotoSyncStatus;
  remoteAttachmentId?: string;
  byteSize?: number;
  width?: number;
  height?: number;
}

export async function updatePhoto(id: string, changes: UpdatePhotoInput): Promise<void> {
  const assignments: string[] = [];
  const params: (string | number | null)[] = [];

  const set = (column: string, value: string | number | null) => {
    assignments.push(`${column} = ?`);
    params.push(value);
  };

  if (changes.localUri !== undefined) set('local_uri', changes.localUri);
  if (changes.tags !== undefined) set('tags_json', JSON.stringify(changes.tags));
  if (changes.caption !== undefined) set('caption', changes.caption);
  if (changes.status !== undefined) set('status', changes.status);
  if (changes.remoteAttachmentId !== undefined) {
    set('remote_attachment_id', changes.remoteAttachmentId);
  }
  if (changes.byteSize !== undefined) set('byte_size', changes.byteSize);
  if (changes.width !== undefined) set('width', changes.width);
  if (changes.height !== undefined) set('height', changes.height);

  if (!assignments.length) return;

  set('updated_at', new Date().toISOString());
  params.push(id);

  const db = await getDatabase();
  await db.runAsync(`UPDATE photos SET ${assignments.join(', ')} WHERE id = ?`, params);
}

export async function getPhoto(id: string): Promise<Photo | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PhotoRow>('SELECT * FROM photos WHERE id = ?', [id]);
  return row ? toPhoto(row) : null;
}

export async function listPhotosForJob(jobId: string): Promise<Photo[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PhotoRow>(
    'SELECT * FROM photos WHERE job_id = ? ORDER BY created_at DESC',
    [jobId],
  );
  return rows.map(toPhoto);
}

/**
 * Deletes the row and its queue task. The file on disk is *not* removed here —
 * that is `storage.ts`'s job, and it runs after the row is gone so a crash
 * between the two leaves an orphan file (recoverable by the sweeper) rather
 * than a row pointing at nothing (a permanent broken thumbnail).
 */
export async function deletePhoto(id: string): Promise<void> {
  await withTransaction(async (db) => {
    await db.runAsync('DELETE FROM upload_queue WHERE photo_id = ?', [id]);
    await db.runAsync('DELETE FROM photos WHERE id = ?', [id]);
  });
}

/** Every local file we still reference, for the orphan-file sweeper. */
export async function listAllPhotoUris(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ local_uri: string }>('SELECT local_uri FROM photos');
  return rows.map((row) => row.local_uri);
}

/** Drafts left behind by an app kill mid-annotation. Safe to discard. */
export async function listStaleDrafts(olderThanMs: number): Promise<Photo[]> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const db = await getDatabase();
  const rows = await db.getAllAsync<PhotoRow>(
    "SELECT * FROM photos WHERE status = 'draft' AND created_at < ?",
    [cutoff],
  );
  return rows.map(toPhoto);
}
