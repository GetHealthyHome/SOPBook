/**
 * Server-side session management using HMAC-SHA256 signed tokens in httpOnly cookies.
 * The SESSION_SECRET never leaves the server. Client JS has zero visibility.
 */
import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

const COOKIE = 'sop_sess';
const MAX_AGE_S = 8 * 60 * 60; // 8 hours

export interface SessionUser {
  name: string;
  role: string;
  userType: 'admin' | 'user';
  iat: number; // unix seconds — issued at
  /** app_users.session_epoch at login. Absent on tokens issued before
   *  revocation support existed; those are treated as epoch 0. */
  epoch?: number;
}

// ---------------------------------------------------------------------------
// Token signing / verification
// ---------------------------------------------------------------------------

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set in .env.local');
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createToken(user: Omit<SessionUser, 'iat'>): string {
  const payload: SessionUser = { ...user, iat: Math.floor(Date.now() / 1000) };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const encoded = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    // Constant-time compare to prevent timing attacks
    const expected = sign(encoded);
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'base64url'), Buffer.from(expected, 'base64url'))) {
      return null;
    }
    const user: SessionUser = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (Math.floor(Date.now() / 1000) - user.iat > MAX_AGE_S) return null; // expired
    return user;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie ?? '';
  return Object.fromEntries(
    header.split(';').map(c => {
      const idx = c.indexOf('=');
      if (idx < 0) return ['', ''];
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    }).filter(([k]) => k)
  );
}

export function getSessionCookie(req: IncomingMessage): string | undefined {
  return parseCookies(req)[COOKIE];
}

export function getSession(req: IncomingMessage): SessionUser | null {
  const raw = getSessionCookie(req);
  if (!raw) return null;
  return verifyToken(raw);
}

const isProduction = process.env.NODE_ENV === 'production';

export function setSessionCookie(res: ServerResponse, token: string): void {
  const flags = [
    `${COOKIE}=${token}`,
    'HttpOnly',
    isProduction ? 'Secure' : '',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${MAX_AGE_S}`,
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', flags);
}

export function clearSessionCookie(res: ServerResponse): void {
  const flags = [
    `${COOKIE}=`,
    'HttpOnly',
    isProduction ? 'Secure' : '',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', flags);
}

// ---------------------------------------------------------------------------
// Live session validation
//
// A signed cookie is self-contained and valid for its full 8-hour life, so on
// its own it cannot express "this person was just demoted / deleted / had
// their password reset". These helpers re-check the account against the
// database, so a privilege change takes effect on the next request instead of
// up to eight hours later.
//
// They fail closed: if the account cannot be confirmed, access is denied.
// ---------------------------------------------------------------------------

export interface LiveSession {
  name: string;
  role: string;
  userType: 'admin' | 'user';
}

/**
 * Re-read the account behind a verified session cookie.
 * Returns null if the session is no longer valid — the account was deleted,
 * or its password/privileges changed after this token was issued.
 */
export async function getLiveSession(session: SessionUser | null): Promise<LiveSession | null> {
  if (!session) return null;

  // Imported lazily so modules that only need cookie helpers don't pull in
  // the database client.
  const { getSupabase } = await import('./supabaseServer');
  const { fallbackAccount } = await import('./fallbackAccounts');

  try {
    const { data, error } = await getSupabase()
      .from('app_users')
      .select('name, role, user_type, session_epoch')
      .eq('name', session.name)
      .maybeSingle();
    if (error) throw error;

    if (data) {
      // Any bump to session_epoch invalidates tokens issued before it.
      const tokenEpoch = session.epoch ?? 0;
      if ((data.session_epoch ?? 0) > tokenEpoch) return null;
      // The database is authoritative for privileges, not the cookie.
      return {
        name: data.name,
        role: data.role,
        userType: data.user_type === 'admin' ? 'admin' : 'user',
      };
    }

    // No row: either an env-var preset account, or an account that has been
    // deleted. Only the former may continue.
    const preset = fallbackAccount(session.name);
    if (preset) return { name: preset.name, role: preset.role, userType: preset.userType };
    return null;
  } catch (err) {
    const { logError } = await import('./log');
    logError('serverAuth/getLiveSession', err);
    return null; // fail closed
  }
}

/** True only if the session still belongs to a current administrator. */
export async function isCurrentAdmin(session: SessionUser | null): Promise<boolean> {
  const live = await getLiveSession(session);
  return live?.userType === 'admin';
}

// ---------------------------------------------------------------------------
// Server-side rate limiting (IP-based, in-memory with TTL cleanup)
//
// Two tiers: 'auth' is strict (credential guessing), 'api' is generous
// enough that a dashboard load (several parallel fetches) and an office
// of users behind one NAT IP never trip it.
// ---------------------------------------------------------------------------

interface IpRecord { count: number; resetAt: number; }
const ipStore = new Map<string, IpRecord>();

const WINDOW_MS = 60_000; // 1-minute rolling window
const LIMITS = { auth: 10, api: 120 } as const;
export type RateLimitBucket = keyof typeof LIMITS;

function cleanIpStore() {
  const now = Date.now();
  ipStore.forEach((rec, key) => {
    if (rec.resetAt < now) ipStore.delete(key);
  });
}

function clientIp(req: IncomingMessage): string {
  // Prefer proxy-set headers over the client-controlled leftmost
  // X-Forwarded-For entry (spoofable, would let attackers rotate
  // fake IPs to bypass the limit). The last XFF hop is appended by
  // the closest trusted proxy.
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) return realIp.trim();
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) {
    const parts = xff.split(',');
    return parts[parts.length - 1].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export function checkIpRateLimit(req: IncomingMessage, bucket: RateLimitBucket = 'api'): boolean {
  if (ipStore.size > 10_000) cleanIpStore();
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  let rec = ipStore.get(key);
  if (!rec || rec.resetAt < now) {
    rec = { count: 0, resetAt: now + WINDOW_MS };
    ipStore.set(key, rec);
  }
  rec.count += 1;
  return rec.count <= LIMITS[bucket];
}
