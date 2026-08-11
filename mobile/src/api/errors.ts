import type { HcpErrorBody } from '@/types';

/**
 * A failed call to Housecall Pro. The important bit is `retryable` — the sync
 * worker uses it to decide between backing off and giving up, and getting that
 * wrong either burns battery re-posting a 422 forever or silently drops a photo
 * on a transient 503.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body?: HcpErrorBody;
  /** Seconds the server asked us to wait, from a `Retry-After` header. */
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    options?: { body?: HcpErrorBody; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = options?.body;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }

  /**
   * 408/429 and 5xx are worth another shot. 4xx otherwise means the request
   * itself is wrong — retrying will fail identically forever.
   *
   * 401 is the interesting exception: it is not retryable as-is, but it is
   * recoverable once the tech re-enters a key, so the queue parks those tasks
   * rather than marking them permanently dead.
   */
  get retryable(): boolean {
    if (this.status === 0) return true; // network reached nothing at all
    if (this.status === 408 || this.status === 429) return true;
    return this.status >= 500;
  }

  /** Distinguishes "your key is bad" from "your request is bad". */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/** Thrown when the device has no usable connection. Always retryable. */
export class OfflineError extends ApiError {
  constructor(message = 'No network connection') {
    super(message, 0);
    this.name = 'OfflineError';
  }
}

export function describeApiError(error: unknown): string {
  if (error instanceof OfflineError) return 'Offline';
  if (error instanceof ApiError) {
    const detail = error.body?.message ?? error.body?.error;
    return detail ? `${error.status}: ${detail}` : `${error.status}: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
