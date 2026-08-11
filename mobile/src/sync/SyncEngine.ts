import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { uploadJobAttachment } from '@/api/housecallPro';
import { ApiError, describeApiError } from '@/api/errors';
import { hasApiToken } from '@/auth/credentials';
import { getDatabase, photosRepo, uploadQueueRepo } from '@/db';
import { deleteFile, fileExists } from '@/storage/photoFiles';
import { logger } from '@/utils/logger';
import { MAX_AUTO_ATTEMPTS, PARKED_UNTIL, isExhausted, nextAttemptAt } from './backoff';
import type { SyncSummary } from '@/types';

export type SyncListener = (summary: SyncSummary) => void;

/** Idle poll, so a task whose backoff expires while the app sits open still fires. */
const IDLE_TICK_MS = 30_000;

/** Bound on one foreground pass, so a 200-photo backlog cannot monopolize the loop. */
const FOREGROUND_MAX_TASKS = 50;

/**
 * Wall-clock budget for a headless pass.
 *
 * iOS hands a `BGProcessingTask` a soft window and kills the process without
 * ceremony when it expires; Android's WorkManager does the same at ten minutes.
 * Stopping ourselves well short means the loop always ends between tasks, with
 * the queue in a consistent state, rather than being shot mid-multipart-post.
 */
const BACKGROUND_BUDGET_MS = 25_000;

/** Ceiling on a headless pass, independent of the clock. */
const BACKGROUND_MAX_TASKS = 25;

/**
 * How long a row must sit in `uploading` before a background pass will reclaim
 * it. Long enough that no live foreground upload could still own it — the API
 * client's own upload timeout is 120s.
 */
const STALE_UPLOAD_MS = 10 * 60_000;

interface DrainOptions {
  maxTasks?: number;
  /** `Date.now()` value past which the loop stops claiming new work. */
  deadlineAt?: number;
}

export interface HeadlessPassResult {
  uploaded: number;
  /** Tasks still expecting a future attempt, excluding parked ones. */
  remaining: number;
  /** Set when the pass declined to do anything, for the log line. */
  skipped?: 'busy' | 'offline' | 'no-credential';
}

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
 *  - **Two entry points, one loop.** `start()` drives the foreground engine —
 *    listeners, idle tick, unbounded time. `runHeadlessPass()` is what an
 *    OS-scheduled wake-up calls: same drain, but bounded by a wall clock and
 *    responsible for establishing its own world, because it may be running in
 *    a JS context where the app never launched. See `backgroundTask.ts`.
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

  /**
   * One bounded pass for an OS-scheduled wake-up, with no listeners, no timers,
   * and no assumption that `start()` ever ran.
   *
   * A headless invocation gets a fresh JS context: the app may be fully dead,
   * so this establishes everything `start()` normally would — database,
   * connectivity, credential — and then drains against a hard clock budget.
   */
  async runHeadlessPass(options: DrainOptions & { budgetMs?: number } = {}): Promise<HeadlessPassResult> {
    // Android's WorkManager will happily fire while the app is alive and
    // already draining. Yield rather than compete for the same rows.
    if (this.isDraining) {
      return { uploaded: 0, remaining: await this.remainingCount(), skipped: 'busy' };
    }

    await getDatabase();

    // Without a credential every upload is a guaranteed 401, and each one would
    // burn a retry attempt on a photo that is otherwise perfectly fine.
    if (!(await hasApiToken())) {
      return { uploaded: 0, remaining: await this.remainingCount(), skipped: 'no-credential' };
    }

    this.isOnline = isUsable(await NetInfo.fetch());
    if (!this.isOnline) {
      return { uploaded: 0, remaining: await this.remainingCount(), skipped: 'offline' };
    }

    const recovered = await uploadQueueRepo.recoverStuckTasks(STALE_UPLOAD_MS);
    if (recovered) logger.info('sync.background.recovered_stuck', { count: recovered });

    const uploaded = await this.drain({
      maxTasks: options.maxTasks ?? BACKGROUND_MAX_TASKS,
      deadlineAt: options.deadlineAt ?? Date.now() + (options.budgetMs ?? BACKGROUND_BUDGET_MS),
    });

    return { uploaded, remaining: await this.remainingCount() };
  }

  private async remainingCount(): Promise<number> {
    return uploadQueueRepo.countUnfinishedTasks(PARKED_UNTIL);
  }

  /** Returns the number of photos this pass actually got upstream. */
  private async drain(options: DrainOptions = {}): Promise<number> {
    if (this.isDraining) return 0;
    this.isDraining = true;

    const maxTasks = options.maxTasks ?? FOREGROUND_MAX_TASKS;
    const deadlineAt = options.deadlineAt ?? Number.POSITIVE_INFINITY;
    const outOfTime = () => Date.now() >= deadlineAt;
    let uploaded = 0;

    try {
      do {
        this.drainRequested = false;
        if (!this.isOnline) break;

        for (let processed = 0; processed < maxTasks; processed += 1) {
          if (!this.isOnline || outOfTime()) break;

          const task = await uploadQueueRepo.claimNextTask();
          if (!task) break;

          await this.emit();
          if (await this.processTask(task)) uploaded += 1;
        }
      } while (this.drainRequested && !outOfTime());

      if (outOfTime()) logger.info('sync.drain.budget_spent', { uploaded });
    } catch (error) {
      logger.error('sync.drain.crashed', { error: String(error) });
    } finally {
      this.isDraining = false;
      await this.emit();
    }

    return uploaded;
  }

  /** True only when the photo reached Housecall Pro on this attempt. */
  private async processTask(task: {
    id: string;
    photoId: string;
    attempts: number;
  }): Promise<boolean> {
    const photo = await photosRepo.getPhoto(task.photoId);

    // The photo row is gone — the tech deleted it while it sat in the queue.
    if (!photo) {
      logger.warn('sync.task.orphaned', { taskId: task.id, photoId: task.photoId });
      await uploadQueueRepo.markTaskDone(task.id);
      return false;
    }

    // Already uploaded, but the queue row survived a crash between the upload
    // succeeding and the row being deleted. Deleting the row here is what stops
    // a duplicate attachment from being created.
    if (photo.status === 'uploaded' && photo.remoteAttachmentId) {
      await uploadQueueRepo.markTaskDone(task.id);
      return false;
    }

    // The file is gone but the row remains. Unrecoverable — retrying can never
    // succeed, so fail it loudly instead of burning eight attempts on nothing.
    if (!(await fileExists(photo.localUri))) {
      logger.error('sync.task.file_missing', { photoId: photo.id, uri: photo.localUri });
      await uploadQueueRepo.markTaskFailed(task.id, 'Local file is missing', PARKED_UNTIL);
      await photosRepo.updatePhoto(photo.id, { status: 'failed' });
      return false;
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
      return true;
    } catch (error) {
      await this.handleUploadFailure(task, photo.id, error);
      return false;
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
