import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sendInvite } from '@/lib/team';
import { isEmailConfigured } from '@/lib/email';
import { logError } from '@/lib/log';

/**
 * Invitations: who is still waiting on one, and resending.
 *
 * A resend always issues a brand-new token and retires the previous one, so
 * an invite forwarded to the wrong inbox stops working the moment a fresh one
 * goes out.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });

  const db = getSupabase();

  // GET — everyone who has not finished setting up, and the state of their invite
  if (req.method === 'GET') {
    const { data: users, error } = await db
      .from('app_users')
      .select('name, role, email, division, password_hash, created_at')
      .is('password_hash', null)
      .order('created_at', { ascending: true });
    if (error) {
      logError('admin/invites GET', error);
      return res.status(500).json({ error: 'Failed to load pending invitations. Make sure db/team_email_invites.sql has been run in Supabase.' });
    }

    const names = (users ?? []).map((u: { name: string }) => u.name);
    let invites: Record<string, { sentAt: string; expiresAt: string; expired: boolean }> = {};
    if (names.length) {
      const { data: rows, error: invErr } = await db
        .from('user_invites')
        .select('user_name, created_at, expires_at, used_at')
        .in('user_name', names)
        .is('used_at', null)
        .order('created_at', { ascending: false });
      if (invErr) logError('admin/invites GET tokens', invErr);
      for (const row of rows ?? []) {
        // Ordered newest first, so the first row seen for a name is the live one.
        if (invites[row.user_name]) continue;
        invites[row.user_name] = {
          sentAt:    row.created_at,
          expiresAt: row.expires_at,
          expired:   new Date(row.expires_at).getTime() < Date.now(),
        };
      }
    }

    const pending = (users ?? []).map((u: Record<string, unknown>) => ({
      name:     u.name,
      role:     u.role,
      email:    u.email ?? '',
      division: u.division ?? '',
      addedAt:  u.created_at,
      invite:   invites[String(u.name)] ?? null,
    }));
    return res.status(200).json({ pending, emailConfigured: isEmailConfigured() });
  }

  // POST — resend an invitation
  if (req.method === 'POST') {
    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required.' });

    const { data: user, error } = await db
      .from('app_users')
      .select('name, email, password_hash')
      .eq('name', name)
      .maybeSingle();
    if (error) {
      logError('admin/invites POST lookup', error);
      return res.status(500).json({ error: 'Failed to resend the invitation.' });
    }
    if (!user) return res.status(404).json({ error: 'No such team member.' });
    if (user.password_hash) {
      return res.status(400).json({ error: `${user.name} has already set a password. Use Reset password instead.` });
    }
    if (!user.email) {
      return res.status(400).json({ error: `${user.name} has no email address on file. Add one first.` });
    }

    const invite = await sendInvite({ name: user.name, email: user.email, by: session.name, resend: true });
    return res.status(200).json({ invite });
  }

  return res.status(405).end();
}
