/**
 * Invite tokens — the single-use links that let a new team member choose
 * their own password instead of being handed one by an admin.
 *
 * Only the SHA-256 of a token is ever stored. A leaked database therefore
 * yields no usable link, and the plaintext exists only in the email and in
 * the response to the admin who triggered it.
 */
import crypto from 'crypto';
import { getSupabase } from './supabaseServer';
import { logError } from './log';
import { appUrl } from './email';

export const INVITE_TTL_DAYS = 7;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function inviteLink(token: string): string {
  return `${appUrl()}/set-password?token=${encodeURIComponent(token)}`;
}

/**
 * Issue a fresh invite for a member, retiring any earlier unused one.
 *
 * Retiring matters: without it, an invite forwarded to the wrong person, or
 * sent to a since-corrected address, would stay usable for a week alongside
 * the replacement. The newest link is always the only one that works.
 */
export async function issueInvite(opts: {
  userName: string;
  email: string;
  createdBy: string;
}): Promise<{ token: string; expiresAt: string } | null> {
  const db = getSupabase();
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: retireErr } = await db
    .from('user_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('user_name', opts.userName)
    .is('used_at', null);
  if (retireErr) logError('invites/retire', retireErr);

  const { error } = await db.from('user_invites').insert({
    user_name:  opts.userName,
    email:      opts.email,
    token_hash: hashToken(token),
    purpose:    'invite',
    expires_at: expiresAt,
    created_by: opts.createdBy,
  });
  if (error) {
    logError('invites/issue', error);
    return null;
  }
  return { token, expiresAt };
}

export interface RedeemedInvite {
  id: number;
  userName: string;
  email: string;
}

/**
 * Look up an unused, unexpired invite by its plaintext token.
 *
 * The lookup is by hash, so an attacker holding the table cannot reverse a
 * row into a working link, and a wrong token simply finds nothing.
 */
export async function findValidInvite(token: string): Promise<RedeemedInvite | null> {
  if (!token || token.length > 200) return null;
  const db = getSupabase();
  const { data, error } = await db
    .from('user_invites')
    .select('id, user_name, email, expires_at, used_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) {
    logError('invites/find', error);
    return null;
  }
  if (!data) return null;
  if (data.used_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return { id: data.id, userName: data.user_name, email: data.email };
}

/** Burn a token so the link cannot be replayed. */
export async function consumeInvite(id: number): Promise<boolean> {
  const db = getSupabase();
  // The `is('used_at', null)` guard makes this a compare-and-set: two requests
  // racing with the same link produce exactly one winner.
  const { data, error } = await db
    .from('user_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();
  if (error) {
    logError('invites/consume', error);
    return false;
  }
  return Boolean(data);
}
