import { getDatabase, photosRepo } from '@/db';
import { sweepOrphanFiles } from '@/storage/photoFiles';
import { syncEngine } from '@/sync/SyncEngine';
// Imported for its side effect as much as its exports: this module's top-level
// `defineTask` is what makes an OS wake-up resolvable when the app is cold.
import { registerBackgroundSync } from '@/sync/backgroundTask';
import { useCatalogStore, useSessionStore, useSyncStore } from '@/state';
import { logger } from '@/utils/logger';

/** Drafts abandoned longer than this were left by a crash, not by a tech. */
const STALE_DRAFT_MS = 24 * 60 * 60 * 1000;

let bootstrapPromise: Promise<void> | null = null;

/**
 * Everything that must happen once, in order, before the UI is trustworthy.
 *
 * The ordering is the whole point:
 *  1. Open and migrate the DB — nothing below can run without it.
 *  2. Read the stored credential, so the UI knows whether to show sign-in.
 *  3. Hydrate from cache, so the first frame has real content offline.
 *  4. Sweep orphan files — strictly *after* the DB is open, since sweeping
 *     against an unopened database would see zero rows and delete every photo.
 *  5. Start the sync engine last, once there is a consistent world to sync.
 */
export async function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    await getDatabase();
    await useSessionStore.getState().load();
    await useCatalogStore.getState().hydrate();

    useSyncStore.getState().attach();
    await syncEngine.start();

    // Only ask the OS for wake-ups we could actually use. An unauthenticated
    // install would be woken on a schedule just to bail on a missing key.
    if (useSessionStore.getState().hasToken) {
      void registerBackgroundSync();
    }

    // Housekeeping runs after the app is usable — it must never delay first paint.
    void cleanUpStaleData();
  })().catch((error) => {
    bootstrapPromise = null;
    logger.error('bootstrap.failed', { error: String(error) });
    throw error;
  });

  return bootstrapPromise;
}

async function cleanUpStaleData(): Promise<void> {
  try {
    const drafts = await photosRepo.listStaleDrafts(STALE_DRAFT_MS);
    for (const draft of drafts) {
      await photosRepo.deletePhoto(draft.id);
    }
    if (drafts.length) logger.info('bootstrap.stale_drafts_removed', { count: drafts.length });

    const referenced = await photosRepo.listAllPhotoUris();
    await sweepOrphanFiles(referenced);
  } catch (error) {
    logger.warn('bootstrap.cleanup.failed', { error: String(error) });
  }
}
