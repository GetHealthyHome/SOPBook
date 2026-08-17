import { deleteFile } from '@/storage/photoFiles';
import { logger } from '@/utils/logger';

/**
 * Keeps a photo's file alive for as long as an export is actually using it.
 *
 * The race this closes is real and would be maddening to diagnose: a tech taps
 * Share, the OS share sheet opens holding a `file://` URI, and while it sits
 * there a background sync finishes uploading that same photo and deletes the
 * file out from under it. The share then fails, or worse, attaches nothing.
 *
 * So an in-flight export takes a hold. `SyncEngine` still uploads, still marks
 * the photo uploaded — it only defers freeing the bytes. When the export
 * finishes the hold releases and the deferred delete runs, putting the photo
 * back in exactly the state it would have been in had the export never
 * happened. The hold changes *when* the file is freed, never *whether*.
 */

/** Count, not a flag: Save and Share can both be in flight on one photo. */
const holds = new Map<string, number>();

/** Files whose delete arrived during a hold and is owed once it clears. */
const deferredDeletes = new Map<string, string>();

export function isHeldForExport(photoId: string): boolean {
  return (holds.get(photoId) ?? 0) > 0;
}

/**
 * Called by the sync engine instead of deleting, when a hold is active.
 * Returns whether the delete was actually deferred, so the caller can fall
 * through to deleting normally when it was not.
 */
export function deferDeleteWhileExporting(photoId: string, uri: string): boolean {
  if (!isHeldForExport(photoId)) return false;
  deferredDeletes.set(photoId, uri);
  logger.info('export.delete_deferred', { photoId });
  return true;
}

async function release(photoId: string): Promise<void> {
  const remaining = (holds.get(photoId) ?? 1) - 1;
  if (remaining > 0) {
    holds.set(photoId, remaining);
    return;
  }

  holds.delete(photoId);

  const owed = deferredDeletes.get(photoId);
  if (!owed) return;

  deferredDeletes.delete(photoId);
  logger.info('export.deferred_delete_run', { photoId });
  await deleteFile(owed);
}

/**
 * Runs `fn` with the photo's file protected from post-upload cleanup.
 *
 * The release is in a `finally` so a thrown or cancelled export cannot leak a
 * hold — a leaked hold would keep the file forever, which is the same storage
 * bug the cleanup exists to prevent.
 */
export async function withExportHold<T>(photoId: string, fn: () => Promise<T>): Promise<T> {
  holds.set(photoId, (holds.get(photoId) ?? 0) + 1);
  try {
    return await fn();
  } finally {
    await release(photoId);
  }
}

/** Test seam. Not called by app code. */
export function __resetExportHolds(): void {
  holds.clear();
  deferredDeletes.clear();
}
