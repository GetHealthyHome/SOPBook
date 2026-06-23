import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const { data, error } = await getSupabase()
    .from('handbook_sections')
    .select('id, title, content, order_index')
    .order('order_index', { ascending: true });

  if (error) return res.status(500).json({ error: 'Failed to load handbook.' });
  return res.status(200).json({ sections: data ?? [] });
}
