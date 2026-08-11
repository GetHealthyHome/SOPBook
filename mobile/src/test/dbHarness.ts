import { closeDatabase, getDatabase } from '@/db/database';
import { photosRepo } from '@/db';
import type { CaptureMetadata, Photo, PhotoTag } from '@/types';

/**
 * Drops whatever database the previous test built and opens a migrated, empty
 * one. Every `openDatabaseAsync` from the sql.js stand-in is a new in-memory
 * database, so closing is all it takes to guarantee isolation.
 */
export async function resetDatabase(): Promise<void> {
  await closeDatabase();
  await getDatabase();
}

export const SAMPLE_METADATA: CaptureMetadata = {
  capturedAtUtc: '2026-03-14T18:30:00.000Z',
  capturedAtLocal: '2026-03-14T11:30:00',
  timeZone: 'America/Denver',
  orientation: 'portrait',
  appVersion: '0.1.0',
  location: {
    latitude: 40.016667,
    longitude: -105.281111,
    accuracy: 4.5,
    fixedAt: '2026-03-14T18:29:58.000Z',
  },
};

/** A saved photo ready to be queued, with only the fields a test cares about. */
export async function makePhoto(
  overrides: { jobId?: string; localUri?: string; tags?: PhotoTag[]; status?: Photo['status'] } = {},
): Promise<Photo> {
  return photosRepo.createPhoto({
    jobId: overrides.jobId ?? 'job_1',
    localUri: overrides.localUri ?? 'file:///photos/photo.jpg',
    metadata: SAMPLE_METADATA,
    tags: overrides.tags ?? ['Attic Insulation'],
    status: overrides.status ?? 'pending',
  });
}
