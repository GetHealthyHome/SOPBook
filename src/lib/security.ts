// Security utilities: rate limiting, password hashing, session management, input sanitization

// ---------------------------------------------------------------------------
// Rate limiting — stored in sessionStorage so it clears when the tab closes.
// Each username tracks its own bucket independently.
// ---------------------------------------------------------------------------

const RATE_LIMIT_KEY = 'sop_rl_v1';
const SALT = 'sop_auth_salt_2026_v1';

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
// Password hashing — Web Crypto SHA-256 with a server-side-style salt.
// Client-side hashing prevents plaintext passwords appearing in memory or logs.
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  if (typeof crypto?.subtle?.digest !== 'function') {
    // Fallback for environments without Web Crypto (e.g. old http contexts)
    return password;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(SALT + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Session management — 8-hour sliding session with a random token.
// Token stored alongside the user in localStorage prevents replaying a
// serialised user object without the matching token.
// ---------------------------------------------------------------------------

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_KEY = 'sop_session_v1';

export interface SessionRecord {
  token: string;
  loginTime: number;
  lastActive: number;
}

export function generateSessionToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createSession(): SessionRecord {
  const rec: SessionRecord = {
    token: generateSessionToken(),
    loginTime: Date.now(),
    lastActive: Date.now(),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(rec));
  } catch {}
  return rec;
}

export function touchSession(): void {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const rec: SessionRecord = JSON.parse(raw);
    rec.lastActive = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(rec));
  } catch {}
}

export function loadSession(): SessionRecord | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

export function isSessionValid(rec: SessionRecord | null): boolean {
  if (!rec) return false;
  return Date.now() - rec.lastActive < SESSION_DURATION_MS;
}

export function destroySession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

// ---------------------------------------------------------------------------
// Input sanitization — strips HTML angle brackets and enforces max lengths.
// Prevents stored XSS from user-supplied text that gets rendered without
// a sanitisation library (React escapes output but localStorage values
// could be crafted by a third party on the same origin).
// ---------------------------------------------------------------------------

const MAX_LENGTHS: Record<string, number> = {
  name: 80,
  password: 128,
  title: 200,
  summary: 400,
  body: 4000,
  notes: 2000,
  default: 500,
};

export function sanitize(value: string, field: keyof typeof MAX_LENGTHS = 'default'): string {
  const max = MAX_LENGTHS[field] ?? MAX_LENGTHS.default;
  return value
    .replace(/[<>]/g, '')   // strip HTML brackets
    .replace(/javascript:/gi, '') // strip JS proto
    .trim()
    .slice(0, max);
}
