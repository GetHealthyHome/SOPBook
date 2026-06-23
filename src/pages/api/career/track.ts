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

  const { name, description, department, orderIndex } = req.body ?? {};
  const cleanName = sanitize(String(name ?? ''), 'title');
  if (!cleanName) return res.status(400).json({ error: 'Track name required.' });

  const allowedDepts = ['Home Performance', 'HVAC'];
  if (!allowedDepts.includes(department)) return res.status(400).json({ error: 'Invalid department.' });

  const { data, error } = await getSupabase()
    .from('career_tracks')
    .insert({
      name:        cleanName,
      description: sanitize(String(description ?? ''), 'summary'),
      department,
      order_index: typeof orderIndex === 'number' ? orderIndex : 0,
    })
    .select().single();

  if (error) return res.status(500).json({ error: 'Insert failed.' });
  return res.status(201).json({ track: data });
}
