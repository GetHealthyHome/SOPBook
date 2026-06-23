import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { createToken, setSessionCookie, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';

const SALT = 'sop_auth_salt_2026_v1';
function sha256(value: string): string {
  return crypto.createHash('sha256').update(SALT + value).digest('hex');
}

// Fallback accounts from env vars — used when app_users table is empty or user not found there.
// Passwords are never hardcoded in source.
const FALLBACK: [string, string, 'admin' | 'user', string][] = [
  ['Marcus Thorne', 'HVAC Supervisor',     'admin', process.env.PW_MARCUS   ?? ''],
  ['Sarah Lin',     'Master Electrician',  'admin', process.env.PW_SARAH    ?? ''],
  ['Alex Rivers',   'Field Apprentice',    'user',  process.env.PW_ALEX     ?? ''],
  ['Derrick Vance', 'Plumbing Specialist', 'user',  process.env.PW_DERRICK  ?? ''],
];
const FALLBACK_MAP: Record<string, { name: string; role: string; userType: 'admin' | 'user'; pwHash: string }> = {};
for (const [name, role, userType, pw] of FALLBACK) {
  FALLBACK_MAP[name.toLowerCase()] = { name, role, userType, pwHash: sha256(pw) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests. Please wait.' });

  const { name, password } = req.body ?? {};
  if (typeof name !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  const key = name.trim().toLowerCase();
  const entered = sha256(password);

  // Check app_users table first (DB-managed accounts take priority over env vars)
  try {
    const { data: dbUser } = await getSupabase()
      .from('app_users')
      .select('name, role, user_type, password_hash')
      .ilike('name', key)
      .maybeSingle();

    if (dbUser) {
      const stored = dbUser.password_hash ?? sha256('__invalid__');
      const match = crypto.timingSafeEqual(Buffer.from(entered, 'hex'), Buffer.from(stored, 'hex'));
      if (!match) return res.status(401).json({ error: 'Invalid credentials.' });
      const token = createToken({ name: dbUser.name, role: dbUser.role, userType: dbUser.user_type as 'admin' | 'user' });
      setSessionCookie(res, token);
      return res.status(200).json({ user: { name: dbUser.name, role: dbUser.role, userType: dbUser.user_type } });
    }
  } catch {
    // DB unavailable — fall through to env var accounts
  }

  // Fallback: env var accounts
  const account = FALLBACK_MAP[key];
  const stored = account?.pwHash ?? sha256('__invalid__');
  const match = crypto.timingSafeEqual(Buffer.from(entered, 'hex'), Buffer.from(stored, 'hex'));
  if (!account || !match) return res.status(401).json({ error: 'Invalid credentials.' });

  const token = createToken({ name: account.name, role: account.role, userType: account.userType });
  setSessionCookie(res, token);
  return res.status(200).json({ user: { name: account.name, role: account.role, userType: account.userType } });
}
