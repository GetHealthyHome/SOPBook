import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  const { trackId, title, description, imageUrls, sopTitle, orderIndex } = req.body ?? {};
  if (typeof trackId !== 'number') return res.status(400).json({ error: 'trackId required.' });
  const cleanTitle = sanitize(String(title ?? ''), 'title');
  if (!cleanTitle) return res.status(400).json({ error: 'Task title required.' });

  const safeUrls = Array.isArray(imageUrls)
    ? imageUrls.map((u: unknown) => sanitize(String(u), 'default')).filter(Boolean)
    : [];

  const { data, error } = await getSupabase()
    .from('career_tasks')
    .insert({
      track_id:    trackId,
      title:       cleanTitle,
      description: sanitize(String(description ?? ''), 'notes'),
      image_urls:  safeUrls,
      sop_title:   sanitize(String(sopTitle ?? ''), 'title'),
      order_index: typeof orderIndex === 'number' ? orderIndex : 0,
    })
    .select().single();

  if (error) return res.status(500).json({ error: 'Insert failed.' });
  return res.status(201).json({ task: data });
}
