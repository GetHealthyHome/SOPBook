import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { logError } from '@/lib/log';

const VALID_BADGES = ['EPA 608', 'Spray Foam', 'BPI', 'Radon', 'Lead', 'Mold Testing', 'Forklift'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — fetch all badge assignments (all users for admins, own only for regular users)
  if (req.method === 'GET') {
    const query = session.userType === 'admin'
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
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { userName, badge } = req.body ?? {};
    if (!userName || typeof userName !== 'string' || userName.length > 80 || !badge) {
      return res.status(400).json({ error: 'userName and badge required.' });
    }
    if (!(VALID_BADGES as readonly string[]).includes(badge)) return res.status(400).json({ error: 'Invalid badge type.' });

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
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
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
