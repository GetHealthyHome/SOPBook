import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  if (req.method === 'DELETE') {
    const { completionId } = req.body ?? {};
    if (typeof completionId !== 'number') return res.status(400).json({ error: 'completionId required.' });

    // Verify the completion belongs to the requesting user before deleting
    const { data: existing } = await db.from('career_completions').select('user_name').eq('id', completionId).single();
    if (!existing || existing.user_name !== session.name) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const { error } = await db.from('career_completions').delete().eq('id', completionId);
    if (error) return res.status(500).json({ error: 'Delete failed.' });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST') {
    const { taskId } = req.body ?? {};
    if (typeof taskId !== 'number') return res.status(400).json({ error: 'taskId required.' });

    const { data, error } = await db.from('career_completions').insert({
      task_id:   taskId,
      user_name: session.name,
      user_role: session.role,
    }).select().single();

    if (error) return res.status(500).json({ error: 'Insert failed.' });
    return res.status(201).json({ completion: data });
  }

  return res.status(405).end();
}
