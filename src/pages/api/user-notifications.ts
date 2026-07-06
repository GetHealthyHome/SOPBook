import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { logError } from '@/lib/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — fetch this user's notifications
  if (req.method === 'GET') {
    const { data, error } = await db
      .from('user_notifications')
      .select('*')
      .eq('user_name', session.name)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      logError('user-notifications GET', error);
      return res.status(500).json({ error: 'Failed to load notifications.' });
    }
    return res.status(200).json({ notifications: data ?? [] });
  }

  // PATCH — mark all as read
  if (req.method === 'PATCH') {
    const { error } = await db
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_name', session.name)
      .is('read_at', null);
    if (error) {
      logError('user-notifications PATCH', error);
      return res.status(500).json({ error: 'Failed to mark as read.' });
    }
    return res.status(200).json({ ok: true });
  }

  // DELETE — dismiss a single notification
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required.' });
    const { error } = await db
      .from('user_notifications')
      .delete()
      .eq('id', id)
      .eq('user_name', session.name);
    if (error) {
      logError('user-notifications DELETE', error);
      return res.status(500).json({ error: 'Failed to dismiss notification.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
