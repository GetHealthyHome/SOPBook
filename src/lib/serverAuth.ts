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
// Server-side rate limiting (IP-based, in-memory with TTL cleanup)
// ---------------------------------------------------------------------------

interface IpRecord { count: number; resetAt: number; }
const ipStore = new Map<string, IpRecord>();

const WINDOW_MS = 60_000;  // 1-minute rolling window
const MAX_PER_WINDOW = 10; // requests per window

function cleanIpStore() {
  const now = Date.now();
  for (const [ip, rec] of ipStore) {
    if (rec.resetAt < now) ipStore.delete(ip);
  }
}

export function checkIpRateLimit(req: IncomingMessage): boolean {
  cleanIpStore();
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
    (req.socket as any)?.remoteAddress ??
    'unknown';
  const now = Date.now();
  const rec = ipStore.get(ip) ?? { count: 0, resetAt: now + WINDOW_MS };
  rec.count += 1;
  if (rec.resetAt < now) { rec.count = 1; rec.resetAt = now + WINDOW_MS; }
  ipStore.set(ip, rec);
  return rec.count <= MAX_PER_WINDOW;
}
