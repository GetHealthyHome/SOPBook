import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { uploadJobAttachment } from '@/api/housecallPro';
import { ApiError, describeApiError } from '@/api/errors';
import { photosRepo, uploadQueueRepo } from '@/db';
import { deleteFile, fileExists } from '@/storage/photoFiles';
import { logger } from '@/utils/logger';
import { MAX_AUTO_ATTEMPTS, PARKED_UNTIL, isExhausted, nextAttemptAt } from './backoff';
import type { SyncSummary } from '@/types';

export type SyncListener = (summary: SyncSummary) => void;

/** Idle poll, so a task whose backoff expires while the app sits open still fires. */
const IDLE_TICK_MS = 30_000;

/**
 * Sequential background uploader for the offline photo queue.
 *
 * Design decisions worth knowing before changing this:
 *
 *  - **Sequential, not parallel.** One upload at a time. Jobsite uplink is the
 *    bottleneck, and three concurrent multipart posts on weak LTE finish slower
 *    in aggregate than three in series while making failures harder to reason
 *    about. Concurrency here would be a pessimization dressed as throughput.
 *
 *  - **One loop, guarded.** `isDraining` is the only thing standing between a
 *    connectivity flap and N overlapping drain loops. The DB-level atomic claim
 *    is the second line of defense; this is the first.
 *
 *  - **Foreground only.** This is not an OS background task. It runs while the
 *    app is open and resumes on foreground. Truly-backgrounded uploads need
 *    `expo-task-manager` + `expo-background-task`, which is a separate change
 *    with its own iOS budget constraints — see the note at the bottom.
 */
class SyncEngine {
  private isDraining = false;
  /** Set when work arrives mid-drain, so the loop makes another pass. */
  private drainRequested = false;
  private isOnline = true;
  private lastSyncedAt: string | undefined;
  private listeners = new Set<SyncListener>();
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeNetInfo: (() => void) | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private currentAbort: AbortController | null = null;
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // A process death mid-upload leaves rows stranded in `uploading`, which no
    // claim query will ever select again. Recover before the first drain.
    const recovered = await uploadQueueRepo.recoverStuckTasks();
    if (recovered) logger.info('sync.recovered_stuck_tasks', { count: recovered });

    const state = await NetInfo.fetch();
    this.isOnline = isUsable(state);

    this.unsubscribeNetInfo = NetInfo.addEventListener((next) => {
      const wasOnline = this.isOnline;
      this.isOnline = isUsable(next);

      if (!this.isOnline && wasOnline) {
        logger.info('sync.offline');
        // Kill the in-flight request rather than letting it hang until timeout;
        // the task is released back to `pending`, not counted as a failure.
        this.currentAbort?.abort();
      } else if (this.isOnline && !wasOnline) {
        logger.info('sync.online');
        void this.requestDrain();
      }
      this.emit();
    });

    this.appStateSubscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') void this.requestDrain();
    });

    this.idleTimer = setInterval(() => void this.requestDrain(), IDLE_TICK_MS);

    await this.requestDrain();
  }

  stop(): void {
    this.unsubscribeNetInfo?.();
    this.unsubscribeNetInfo = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
    this.currentAbort?.abort();
    this.started = false;
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    void this.emit();
    return () => this.listeners.delete(listener);
  }

  /** Enqueues a saved photo and kicks the worker. */
  async enqueue(photoId: string, jobId: string): Promise<void> {
    await uploadQueueRepo.enqueuePhoto(photoId, jobId);
    await photosRepo.updatePhoto(photoId, { status: 'pending' });
    await this.requestDrain();
  }

  /** Manual "Retry all" from the queue screen. Clears backoff and parked state. */
  async retryFailed(): Promise<void> {
    const count = await uploadQueueRepo.retryAllFailed();
    logger.info('sync.retry_all', { count });
    await this.requestDrain();
  }

  /**
   * Asks the loop to run. Coalesces: if a drain is already running, this sets a
   * flag so the running loop makes one more pass instead of starting a second.
   */
  async requestDrain(): Promise<void> {
    if (this.isDraining) {
      this.drainRequested = true;
      return;
    }
    await this.drain();
  }

  private async drain(): Promise<void> {
    if (this.isDraining) return;
    this.isDraining = true;

    try {
      do {
        this.drainRequested = false;
        if (!this.isOnline) break;

        // Bounded per pass so a 200-photo backlog cannot monopolize the loop
        // forever; the idle tick picks up where this left off.
        for (let processed = 0; processed < 50; processed += 1) {
          if (!this.isOnline) break;

          const task = await uploadQueueRepo.claimNextTask();
          if (!task) break;

          await this.emit();
          await this.processTask(task);
        }
      } while (this.drainRequested);
    } catch (error) {
      logger.error('sync.drain.crashed', { error: String(error) });
    } finally {
      this.isDraining = false;
      await this.emit();
    }
  }

  private async processTask(task: { id: string; photoId: string; attempts: number }): Promise<void> {
    const photo = await photosRepo.getPhoto(task.photoId);

    // The photo row is gone — the tech deleted it while it sat in the queue.
    if (!photo) {
      logger.warn('sync.task.orphaned', { taskId: task.id, photoId: task.photoId });
      await uploadQueueRepo.markTaskDone(task.id);
      return;
    }

    // Already uploaded, but the queue row survived a crash between the upload
    // succeeding and the row being deleted. Deleting the row here is what stops
    // a duplicate attachment from being created.
    if (photo.status === 'uploaded' && photo.remoteAttachmentId) {
      await uploadQueueRepo.markTaskDone(task.id);
      return;
    }

    // The file is gone but the row remains. Unrecoverable — retrying can never
    // succeed, so fail it loudly instead of burning eight attempts on nothing.
    if (!(await fileExists(photo.localUri))) {
      logger.error('sync.task.file_missing', { photoId: photo.id, uri: photo.localUri });
      await uploadQueueRepo.markTaskFailed(task.id, 'Local file is missing', PARKED_UNTIL);
      await photosRepo.updatePhoto(photo.id, { status: 'failed' });
      return;
    }

    await photosRepo.updatePhoto(photo.id, { status: 'uploading' });

    const abort = new AbortController();
    this.currentAbort = abort;

    try {
      const attachment = await uploadJobAttachment(photo, { signal: abort.signal });

      await photosRepo.updatePhoto(photo.id, {
        status: 'uploaded',
        remoteAttachmentId: attachment.id,
      });
      await uploadQueueRepo.markTaskDone(task.id);

      // The bytes are safe upstream and this is the tech's only storage. Freeing
      // it now is what keeps a 60-photo day from filling a 64 GB phone.
      await deleteFile(photo.localUri);

      this.lastSyncedAt = new Date().toISOString();
      logger.info('sync.uploaded', { photoId: photo.id, attachmentId: attachment.id });
    } catch (error) {
      await this.handleUploadFailure(task, photo.id, error);
    } finally {
      this.currentAbort = null;
    }
  }

  private async handleUploadFailure(
    task: { id: string; attempts: number },
    photoId: string,
    error: unknown,
  ): Promise<void> {
    const message = describeApiError(error);

    // We took the phone offline mid-flight. Not the task's fault — put it back
    // without spending an attempt, or a subway ride would exhaust the queue.
    if (!this.isOnline) {
      await uploadQueueRepo.releaseTask(task.id);
      await photosRepo.updatePhoto(photoId, { status: 'pending' });
      logger.info('sync.task.released_offline', { photoId });
      return;
    }

    const apiError = error instanceof ApiError ? error : undefined;
    const attempts = task.attempts + 1;

    // A bad key is recoverable, but not by retrying — park it and let the tech
    // fix credentials. Same for a permanently-rejected request.
    const unrecoverable = apiError && !apiError.retryable;
    const parked = unrecoverable || isExhausted(attempts);

    await uploadQueueRepo.markTaskFailed(
      task.id,
      message,
      parked
        ? PARKED_UNTIL
        : nextAttemptAt(attempts, { retryAfterSeconds: apiError?.retryAfterSeconds }),
    );
    await photosRepo.updatePhoto(photoId, { status: parked ? 'failed' : 'pending' });

    logger.warn('sync.upload.failed', {
      photoId,
      attempts,
      maxAttempts: MAX_AUTO_ATTEMPTS,
      parked,
      error: message,
    });
  }

  private async emit(): Promise<void> {
    if (!this.listeners.size) return;
    const counts = await uploadQueueRepo.getQueueCounts();
    const summary: SyncSummary = {
      ...counts,
      isOnline: this.isOnline,
      lastSyncedAt: this.lastSyncedAt,
    };
    for (const listener of this.listeners) listener(summary);
  }
}

/**
 * NetInfo reports `isInternetReachable: null` while it is still probing. Treating
 * null as offline would stall the queue for seconds on every app launch, so we
 * only believe an explicit `false`.
 */
function isUsable(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export const syncEngine = new SyncEngine();

/*
 * Deferred: true OS-backgrounded uploads.
 *
 * Today the queue drains while the app is foregrounded. Uploading after the
 * tech pockets the phone requires `expo-background-task` (iOS
 * BGProcessingTask), which the OS schedules opportunistically — typically when
 * charging and on Wi-Fi, with no guaranteed timing. It is worth adding, but it
 * changes the failure model enough to deserve its own pass rather than being
 * bolted on here.
 */
