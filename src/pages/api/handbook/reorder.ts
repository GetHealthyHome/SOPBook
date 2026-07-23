import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { logError } from '@/lib/log';

const MAX_SECTIONS = 500;

/**
 * Admin-only: set the display order of handbook sections. Accepts the
 * full list of section ids in the desired order and writes each one's
 * order_index to its position. Purely presentational — it does not touch
 * title/content, so acknowledgements are unaffected.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  const { order } = req.body ?? {};
  if (!Array.isArray(order) || order.length === 0 || order.length > MAX_SECTIONS ||
      order.some(id => typeof id !== 'string')) {
    return res.status(400).json({ error: 'order must be a non-empty array of section ids.' });
  }

  const db = getSupabase();
  for (let i = 0; i < order.length; i++) {
    const { error } = await db.from('handbook_sections').update({ order_index: i }).eq('id', order[i]);
    if (error) {
      logError('handbook/reorder', error);
      return res.status(500).json({ error: 'Failed to save new order.' });
    }
  }
  return res.status(200).json({ ok: true });
}
