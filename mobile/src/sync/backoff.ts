/** Base delay for the first retry. */
const BASE_DELAY_MS = 5_000;
/** Ceiling, so a long outage settles into a 5-minute poll rather than hours. */
const MAX_DELAY_MS = 5 * 60_000;
/**
 * After this many attempts a task stops being retried automatically and waits
 * for the tech to tap Retry. It is not deleted — the photo still exists and
 * still matters; we just stop burning battery on something that is not working.
 */
export const MAX_AUTO_ATTEMPTS = 8;

/**
 * Exponential backoff with full jitter.
 *
 * The jitter is not decoration. A crew of six trucks pulls out of a dead zone
 * onto the same tower at the same moment; without jitter all six devices retry
 * in lockstep and hammer the API in synchronized waves. Full jitter spreads
 * them across the window.
 */
export function backoffDelayMs(attempts: number, random: () => number = Math.random): number {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts));
  return Math.round(random() * exponential);
}

/**
 * Epoch ms for the next attempt. A server-sent `Retry-After` always wins over
 * our own schedule — if Housecall Pro says wait 60s, waiting 5s just earns
 * another 429.
 */
export function nextAttemptAt(
  attempts: number,
  options: { retryAfterSeconds?: number; now?: number; random?: () => number } = {},
): number {
  const now = options.now ?? Date.now();
  if (options.retryAfterSeconds !== undefined) {
    return now + Math.max(0, options.retryAfterSeconds) * 1000;
  }
  return now + backoffDelayMs(attempts, options.random);
}

/** True once a task has burned through its automatic retries. */
export function isExhausted(attempts: number): boolean {
  return attempts >= MAX_AUTO_ATTEMPTS;
}

/** Parks a task until the tech intervenes, without deleting it. */
export const PARKED_UNTIL = Number.MAX_SAFE_INTEGER;
