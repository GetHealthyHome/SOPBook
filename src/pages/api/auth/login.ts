import type { NextApiRequest, NextApiResponse } from 'next';
import { createToken, setSessionCookie, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { verifyPassword, hashPassword, legacySha256, needsRehash, MAX_PASSWORD_LEN } from '@/lib/passwords';
import { logError } from '@/lib/log';

// Fallback accounts from env vars — used when the app_users table is
// unavailable or the user isn't found there. Accounts whose env password
// is missing/empty are disabled entirely (never loginable).
const FALLBACK: [string, string, 'admin' | 'user', string | undefined][] = [
  ['Marcus Thorne', 'HVAC Supervisor',     'admin', process.env.PW_MARCUS],
  ['Sarah Lin',     'Master Electrician',  'admin', process.env.PW_SARAH],
  ['Alex Rivers',   'Field Apprentice',    'user',  process.env.PW_ALEX],
  ['Derrick Vance', 'Plumbing Specialist', 'user',  process.env.PW_DERRICK],
];
const FALLBACK_MAP: Record<string, { name: string; role: string; userType: 'admin' | 'user'; pwHash: string }> = {};
for (const [name, role, userType, pw] of FALLBACK) {
  if (!pw) continue; // no password configured — account disabled
  FALLBACK_MAP[name.toLowerCase()] = { name, role, userType, pwHash: legacySha256(pw) };
}

// Escape ILIKE pattern metacharacters so a login name like "%" can't
// match arbitrary rows.
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkIpRateLimit(req, 'auth')) return res.status(429).json({ error: 'Too many requests. Please wait.' });

  const { name, password } = req.body ?? {};
  if (typeof name !== 'string' || typeof password !== 'string' ||
      !name.trim() || !password || name.length > 80 || password.length > MAX_PASSWORD_LEN) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  const key = name.trim().toLowerCase();

  // Check app_users table first (DB-managed accounts take priority over env vars)
  try {
    const { data: dbUser, error } = await getSupabase()
      .from('app_users')
      .select('name, role, user_type, password_hash')
      .ilike('name', escapeIlike(key))
      .maybeSingle();
    if (error) throw error;

    if (dbUser) {
      if (!verifyPassword(password, dbUser.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      // Transparently upgrade legacy SHA-256 hashes to scrypt
      if (dbUser.password_hash && needsRehash(dbUser.password_hash)) {
        const { error: upgradeErr } = await getSupabase()
          .from('app_users')
          .update({ password_hash: hashPassword(password) })
          .eq('name', dbUser.name);
        if (upgradeErr) logError('auth/login rehash', upgradeErr);
      }
      const token = createToken({ name: dbUser.name, role: dbUser.role, userType: dbUser.user_type as 'admin' | 'user' });
      setSessionCookie(res, token);
      return res.status(200).json({ user: { name: dbUser.name, role: dbUser.role, userType: dbUser.user_type } });
    }
  } catch (err) {
    // DB unavailable — log it, then fall through to env var accounts
    logError('auth/login db-lookup', err);
  }

  // Fallback: env var accounts (legacy SHA-256 comparison, constant time)
  const account = FALLBACK_MAP[key];
  const match = verifyPassword(password, account?.pwHash ?? legacySha256('__invalid__'));
  if (!account || !match) return res.status(401).json({ error: 'Invalid credentials.' });

  const token = createToken({ name: account.name, role: account.role, userType: account.userType });
  setSessionCookie(res, token);
  return res.status(200).json({ user: { name: account.name, role: account.role, userType: account.userType } });
}
