import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncEngine } from './SyncEngine';
import { logger } from '@/utils/logger';

/**
 * Stable across releases — the OS persists registrations by name, so renaming
 * this orphans the old registration on every device that already has it.
 */
export const BACKGROUND_SYNC_TASK = 'retrofit-field.background-sync';

/**
 * Floor, not a schedule. Both platforms treat it as "no sooner than", and iOS
 * in particular batches these into windows it picks — usually overnight, on
 * power, on Wi-Fi. Asking for 15 minutes does not get 15 minutes; it gets the
 * app into the pool of things the scheduler is willing to consider that often.
 */
const MINIMUM_INTERVAL_MINUTES = 15;

/**
 * The task body must be defined at module scope.
 *
 * When the OS wakes a terminated app, it boots a bare JS context and runs the
 * entry bundle looking for this registration. Nothing renders, no effect fires,
 * no component mounts — so a `defineTask` sitting inside a hook would never be
 * reached and the wake-up would be dropped as an unknown task.
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await syncEngine.runHeadlessPass();
    logger.info('sync.background.pass', {
      uploaded: result.uploaded,
      remaining: result.remaining,
      skipped: result.skipped,
    });

    // `Failed` is not an error report here — it is how a task tells the
    // scheduler the work is unfinished, which is what earns the next slot.
    // Claiming success with photos still queued would quietly cost the tech a
    // delivery window, so the honest answer is the useful one.
    return result.remaining > 0
      ? BackgroundTask.BackgroundTaskResult.Failed
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    logger.error('sync.background.crashed', { error: String(error) });
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Registers the wake-up, if the device allows one at all.
 *
 * Safe to call repeatedly: registration is persistent, so re-registering on
 * every launch would churn the scheduler's bookkeeping for no gain.
 */
export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      // Low Power Mode, Screen Time restrictions, or an OEM battery manager.
      // Foreground syncing still works; this is a degradation, not a failure.
      logger.info('sync.background.unavailable', { status });
      return;
    }

    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) return;

    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: MINIMUM_INTERVAL_MINUTES,
    });
    logger.info('sync.background.registered', { minutes: MINIMUM_INTERVAL_MINUTES });
  } catch (error) {
    logger.warn('sync.background.register_failed', { error: String(error) });
  }
}

/**
 * Called on sign-out. A registration that survives the credential would wake
 * the device on a schedule only to discover it has nothing it may upload.
 */
export async function unregisterBackgroundSync(): Promise<void> {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK))) return;
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    logger.info('sync.background.unregistered');
  } catch (error) {
    logger.warn('sync.background.unregister_failed', { error: String(error) });
  }
}

/** Whether the OS will schedule us at all — surfaced on the queue screen. */
export async function isBackgroundSyncAvailable(): Promise<boolean> {
  try {
    return (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available;
  } catch {
    return false;
  }
}
