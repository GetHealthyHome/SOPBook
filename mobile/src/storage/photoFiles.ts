import * as FileSystem from 'expo-file-system';
import { logger } from '@/utils/logger';

/**
 * Photos live under `documentDirectory`, not `cacheDirectory`.
 *
 * That distinction is load-bearing: iOS evicts `cacheDirectory` under storage
 * pressure without warning, and a tech's only copy of an un-uploaded attic
 * photo disappearing because the phone got low on space is unacceptable.
 * `documentDirectory` is backed up and never evicted.
 */
const PHOTO_DIR = `${FileSystem.documentDirectory}photos/`;

async function ensureDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

export function photoPathFor(photoId: string): string {
  return `${PHOTO_DIR}${photoId}.jpg`;
}

/**
 * Moves a freshly captured file out of the camera's temp location into
 * permanent storage. Move, not copy — the source is in `cacheDirectory` and
 * copying would briefly double the disk usage of every capture.
 */
export async function persistCapture(sourceUri: string, photoId: string): Promise<string> {
  await ensureDirectory();
  const destination = photoPathFor(photoId);

  try {
    await FileSystem.moveAsync({ from: sourceUri, to: destination });
  } catch (error) {
    // Cross-volume moves fail on some Android OEM builds; fall back to copy.
    logger.warn('storage.move_failed_falling_back_to_copy', { error: String(error) });
    await FileSystem.copyAsync({ from: sourceUri, to: destination });
    await FileSystem.deleteAsync(sourceUri, { idempotent: true }).catch(() => undefined);
  }

  return destination;
}

export async function getFileSize(uri: string): Promise<number | undefined> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  return info.exists && !info.isDirectory ? info.size : undefined;
}

export async function deleteFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch((error) => {
    logger.warn('storage.delete_failed', { uri, error: String(error) });
  });
}

export async function fileExists(uri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists;
}

/**
 * Deletes image files no photo row points at.
 *
 * These accumulate from crashes between "write the file" and "insert the row".
 * Run at startup, after the DB is open — running it before would see an empty
 * table and delete every photo on the device.
 */
export async function sweepOrphanFiles(referencedUris: string[]): Promise<number> {
  await ensureDirectory();
  const referenced = new Set(referencedUris);
  const names = await FileSystem.readDirectoryAsync(PHOTO_DIR);

  let removed = 0;
  for (const name of names) {
    const uri = `${PHOTO_DIR}${name}`;
    if (referenced.has(uri)) continue;
    await deleteFile(uri);
    removed += 1;
  }

  if (removed) logger.info('storage.orphans_swept', { removed });
  return removed;
}

/** Total bytes held by pending uploads, for the queue screen's footer. */
export async function totalPhotoBytes(): Promise<number> {
  await ensureDirectory();
  const names = await FileSystem.readDirectoryAsync(PHOTO_DIR);
  let total = 0;
  for (const name of names) {
    const info = await FileSystem.getInfoAsync(`${PHOTO_DIR}${name}`, { size: true });
    if (info.exists && !info.isDirectory) total += info.size;
  }
  return total;
}
