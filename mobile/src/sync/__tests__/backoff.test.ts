import { MAX_AUTO_ATTEMPTS, backoffDelayMs, isExhausted, nextAttemptAt } from '../backoff';

describe('backoffDelayMs', () => {
  it('grows exponentially when jitter is at its maximum', () => {
    const noJitter = () => 1;
    expect(backoffDelayMs(0, noJitter)).toBe(5_000);
    expect(backoffDelayMs(1, noJitter)).toBe(10_000);
    expect(backoffDelayMs(2, noJitter)).toBe(20_000);
    expect(backoffDelayMs(3, noJitter)).toBe(40_000);
  });

  it('caps at five minutes so a long outage settles into a slow poll', () => {
    expect(backoffDelayMs(20, () => 1)).toBe(300_000);
  });

  it('spreads retries across the window rather than firing in lockstep', () => {
    // The whole point of jitter: two devices with identical attempt counts must
    // not pick the same delay, or a crew leaving a dead zone hammers the API.
    expect(backoffDelayMs(3, () => 0)).toBe(0);
    expect(backoffDelayMs(3, () => 0.5)).toBe(20_000);
    expect(backoffDelayMs(3, () => 1)).toBe(40_000);
  });

  it('treats a negative attempt count as the first attempt', () => {
    expect(backoffDelayMs(-5, () => 1)).toBe(5_000);
  });
});

describe('nextAttemptAt', () => {
  it('honors a server Retry-After over our own schedule', () => {
    const now = 1_000_000;
    expect(nextAttemptAt(5, { retryAfterSeconds: 60, now, random: () => 1 })).toBe(now + 60_000);
  });

  it('clamps a negative Retry-After to now instead of scheduling in the past', () => {
    const now = 1_000_000;
    expect(nextAttemptAt(1, { retryAfterSeconds: -30, now })).toBe(now);
  });

  it('falls back to jittered exponential backoff without a Retry-After', () => {
    const now = 1_000_000;
    expect(nextAttemptAt(1, { now, random: () => 1 })).toBe(now + 10_000);
  });
});

describe('isExhausted', () => {
  it('stops automatic retries only after the full budget is spent', () => {
    expect(isExhausted(MAX_AUTO_ATTEMPTS - 1)).toBe(false);
    expect(isExhausted(MAX_AUTO_ATTEMPTS)).toBe(true);
  });
});
