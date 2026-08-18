import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { logError } from '@/lib/log';

/** A badge may only be assigned if it exists in the badge_types catalogue.
 *  This used to be a hardcoded array, which meant adding a certification
 *  needed a code change; it is now whatever an admin has created. */
async function isKnownBadge(db: ReturnType<typeof getSupabase>, badge: string): Promise<boolean> {
  const { data, error } = await db.from('badge_types').select('name').eq('name', badge).maybeSingle();
  if (error) {
    logError('badges validate', error);
    return false; // fail closed
  }
  return !!data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — fetch all badge assignments (all users for admins, own only for regular users)
  if (req.method === 'GET') {
    const query = (await isCurrentAdmin(session))
      ? db.from('user_badges').select('*')
      : db.from('user_badges').select('*').eq('user_name', session.name);
    const { data, error } = await query;
    if (error) {
      logError('badges GET', error);
      return res.status(500).json({ error: 'Failed to load badges.' });
    }
    return res.status(200).json({ badges: data ?? [] });
  }

  // POST — assign a badge (admin only)
  if (req.method === 'POST') {
    if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });
    const { userName, badge } = req.body ?? {};
    if (!userName || typeof userName !== 'string' || userName.length > 80 || !badge) {
      return res.status(400).json({ error: 'userName and badge required.' });
    }
    if (!(await isKnownBadge(db, badge))) return res.status(400).json({ error: 'Unknown badge type.' });

    const { data, error } = await db
      .from('user_badges')
      .upsert({ user_name: userName, badge, assigned_by: session.name }, { onConflict: 'user_name,badge' })
      .select().single();
    if (error) {
      logError('badges POST', error);
      return res.status(500).json({ error: 'Failed to assign badge.' });
    }
    return res.status(201).json({ badge: data });
  }

  // DELETE — revoke a badge (admin only)
  if (req.method === 'DELETE') {
    if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });
    const { userName, badge } = req.body ?? {};
    if (!userName || !badge) return res.status(400).json({ error: 'userName and badge required.' });

    const { error } = await db
      .from('user_badges')
      .delete()
      .eq('user_name', userName)
      .eq('badge', badge);
    if (error) {
      logError('badges DELETE', error);
      return res.status(500).json({ error: 'Failed to revoke badge.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
