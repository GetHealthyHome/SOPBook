import type { NextApiRequest, NextApiResponse } from 'next';
import { checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { hashPassword, MAX_PASSWORD_LEN } from '@/lib/passwords';
import { findValidInvite, consumeInvite } from '@/lib/invites';
import { logError } from '@/lib/log';

/**
 * Redeem an invitation and set a password.
 *
 * This is the one authenticated-by-token endpoint in the app, so it is
 * deliberately narrow:
 *
 *   • It is rate limited on the strict 'auth' bucket, like signing in.
 *   • The account it acts on comes from the token, never from the request —
 *     there is no way to name someone else and set their password.
 *   • The token is consumed before the password is written, and the consume
 *     is a compare-and-set, so two clicks on the same link cannot both win.
 *   • Errors are indistinguishable between "wrong token", "already used" and
 *     "expired", so the endpoint cannot be used to probe for live invites.
 *
 * It does NOT sign the person in. They land on the login screen and enter the
 * password they just chose, which proves it was stored and is the last step
 * of setup rather than a surprise.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Used by the page to decide whether to show the form or an "ask for a
    // new link" message, without revealing anything beyond validity.
    if (!checkIpRateLimit(req, 'auth')) return res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const invite = await findValidInvite(token);
    if (!invite) return res.status(200).json({ valid: false });
    return res.status(200).json({ valid: true, name: invite.userName });
  }

  if (req.method !== 'POST') return res.status(405).end();
  if (!checkIpRateLimit(req, 'auth')) return res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });

  const { token, password } = req.body ?? {};
  const pw = String(password ?? '');
  if (pw.length < 8) return res.status(400).json({ error: 'Choose a password of at least 8 characters.' });
  if (pw.length > MAX_PASSWORD_LEN) return res.status(400).json({ error: 'That password is too long.' });

  const invite = await findValidInvite(String(token ?? ''));
  if (!invite) {
    return res.status(400).json({ error: 'This link is no longer valid. Ask an administrator to send a new invitation.' });
  }

  // Burn the token first. If the password write then fails the link is spent,
  // which is the safe direction to fail: a new invite can always be issued,
  // whereas a reusable link is a standing way in.
  if (!(await consumeInvite(invite.id))) {
    return res.status(400).json({ error: 'This link is no longer valid. Ask an administrator to send a new invitation.' });
  }

  const db = getSupabase();
  const { data, error } = await db
    .from('app_users')
    .update({
      password_hash: hashPassword(pw),
      // Bumping the epoch ends any session that predates this password.
      session_epoch: Math.floor(Date.now() / 1000),
    })
    .eq('name', invite.userName)
    .select('name')
    .maybeSingle();

  if (error) {
    logError('auth/set-password update', error);
    return res.status(500).json({ error: 'Could not save that password. Try again in a moment.' });
  }
  if (!data) {
    return res.status(400).json({ error: 'That account no longer exists. Ask an administrator to add you again.' });
  }

  return res.status(200).json({ ok: true, name: data.name });
}
