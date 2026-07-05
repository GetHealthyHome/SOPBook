// Shared security utilities: client-side login-attempt UX throttling and
// input sanitization. Real enforcement (auth, rate limits, hashing) lives
// server-side in src/lib/serverAuth.ts and src/lib/passwords.ts.

// ---------------------------------------------------------------------------
// Login attempt throttling (UX feedback only) — stored in sessionStorage so
// it clears when the tab closes. Each username tracks its own bucket.
// The server independently enforces IP-based rate limiting.
// ---------------------------------------------------------------------------

const RATE_LIMIT_KEY = 'sop_rl_v1';

// Thresholds and corresponding lockout durations (ms)
const THRESHOLDS = [3, 5, 10] as const;
const LOCKOUTS   = [30_000, 300_000, 3_600_000] as const; // 30 s, 5 min, 1 hr

export interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

function readRateStore(): Record<string, AttemptRecord> {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeRateStore(store: Record<string, AttemptRecord>): void {
  try {
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(store));
  } catch {}
}

export function getAttemptRecord(username: string): AttemptRecord {
  const store = readRateStore();
  return store[username.toLowerCase()] ?? { count: 0, lockedUntil: 0 };
}

export function recordFailedAttempt(username: string): AttemptRecord {
  const store = readRateStore();
  const key = username.toLowerCase();
  const rec: AttemptRecord = store[key] ?? { count: 0, lockedUntil: 0 };

  rec.count += 1;

  // Apply the most severe applicable lockout
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (rec.count >= THRESHOLDS[i]) {
      rec.lockedUntil = Date.now() + LOCKOUTS[i];
      break;
    }
  }

  store[key] = rec;
  writeRateStore(store);
  return rec;
}

export function clearAttempts(username: string): void {
  const store = readRateStore();
  delete store[username.toLowerCase()];
  writeRateStore(store);
}

export function isLockedOut(rec: AttemptRecord): boolean {
  return rec.lockedUntil > Date.now();
}

export function lockoutRemainingMs(rec: AttemptRecord): number {
  return Math.max(0, rec.lockedUntil - Date.now());
}

/** How many attempts remain before the next lockout tier. */
export function attemptsUntilNextLock(rec: AttemptRecord): number {
  for (const threshold of THRESHOLDS) {
    if (rec.count < threshold) return threshold - rec.count;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Input sanitization — strips HTML angle brackets and enforces max lengths.
// Used on the server for all persisted user-supplied text, and on the client
// for immediate feedback before submitting.
// ---------------------------------------------------------------------------

const MAX_LENGTHS = {
  name: 80,
  password: 128,
  title: 200,
  summary: 400,
  body: 4000,
  notes: 2000,
  default: 500,
} as const;

export function sanitize(value: string, field: keyof typeof MAX_LENGTHS = 'default'): string {
  const max = MAX_LENGTHS[field] ?? MAX_LENGTHS.default;
  return value
    .replace(/[<>]/g, '')   // strip HTML brackets
    .replace(/javascript:/gi, '') // strip JS proto
    .trim()
    .slice(0, max);
}
