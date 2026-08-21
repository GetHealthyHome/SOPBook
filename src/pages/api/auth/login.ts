import type { NextApiRequest, NextApiResponse } from 'next';
import { createToken, setSessionCookie, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { verifyPassword, hashPassword, legacySha256, needsRehash, MAX_PASSWORD_LEN } from '@/lib/passwords';
import { fallbackAccounts } from '@/lib/fallbackAccounts';
import { logError } from '@/lib/log';

// Preset env-var accounts live in a shared module so the live-session check
// can recognise a session that has no database row behind it.

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
      .select('name, role, user_type, password_hash, session_epoch')
      .ilike('name', escapeIlike(key))
      .maybeSingle();
    if (error) throw error;

    if (dbUser) {
      // An invited member who has not redeemed their link yet has no hash.
      // Say so plainly rather than "invalid credentials": they typed nothing
      // wrong, and the fix is a new invitation, not another guess. This does
      // confirm the account exists, which is an accepted trade — the invite
      // token still lives only in their inbox.
      if (!dbUser.password_hash) {
        return res.status(403).json({ error: 'Your account is set up but has no password yet. Use the "Set your password" link in your invitation email, or ask an administrator to resend it.' });
      }
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
      // Stamping the account's current epoch lets a later bump (password
      // reset, demotion) invalidate this token.
      const token = createToken({
        name: dbUser.name,
        role: dbUser.role,
        userType: dbUser.user_type as 'admin' | 'user',
        epoch: dbUser.session_epoch ?? 0,
      });
      setSessionCookie(res, token);
      return res.status(200).json({ user: { name: dbUser.name, role: dbUser.role, userType: dbUser.user_type } });
    }
  } catch (err) {
    // DB unavailable — log it, then fall through to env var accounts
    logError('auth/login db-lookup', err);
  }

  // Fallback: env var accounts (legacy SHA-256 comparison, constant time)
  const account = fallbackAccounts()[key];
  const match = verifyPassword(password, account ? legacySha256(account.password) : legacySha256('__invalid__'));
  if (!account || !match) return res.status(401).json({ error: 'Invalid credentials.' });

  const token = createToken({ name: account.name, role: account.role, userType: account.userType });
  setSessionCookie(res, token);
  return res.status(200).json({ user: { name: account.name, role: account.role, userType: account.userType } });
}
