import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  const { userName, userRole, trackId, existingId } = req.body ?? {};
  if (!userName || !userRole || typeof trackId !== 'number') {
    return res.status(400).json({ error: 'userName, userRole, trackId required.' });
  }

  const db = getSupabase();

  if (typeof existingId === 'number') {
    const { data, error } = await db
      .from('career_assignments')
      .update({ track_id: trackId, assigned_by: session.name, assigned_at: new Date().toISOString() })
      .eq('id', existingId)
      .select().single();
    if (error) return res.status(500).json({ error: 'Update failed.' });
    return res.status(200).json({ assignment: data });
  }

  const { data, error } = await db
    .from('career_assignments')
    .insert({ user_name: userName, user_role: userRole, track_id: trackId, assigned_by: session.name })
    .select().single();
  if (error) return res.status(500).json({ error: 'Insert failed.' });
  return res.status(201).json({ assignment: data });
}
