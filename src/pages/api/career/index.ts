import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();
  const isAdmin = session.userType === 'admin';

  const [tracksRes, tasksRes, myCompRes, allCompRes, myAssignRes, allAssignRes] = await Promise.all([
    db.from('career_tracks').select('*').order('order_index'),
    db.from('career_tasks').select('*').order('order_index'),
    db.from('career_completions').select('*').eq('user_name', session.name),
    isAdmin ? db.from('career_completions').select('*') : Promise.resolve({ data: [], error: null }),
    db.from('career_assignments').select('*').eq('user_name', session.name).maybeSingle(),
    isAdmin ? db.from('career_assignments').select('*') : Promise.resolve({ data: [], error: null }),
  ]);

  if (tracksRes.error) return res.status(500).json({ error: 'Failed to load career tracks.' });
  if (tasksRes.error)  return res.status(500).json({ error: 'Failed to load career tasks.' });

  return res.status(200).json({
    tracks:         tracksRes.data ?? [],
    tasks:          tasksRes.data  ?? [],
    myCompletions:  myCompRes.data ?? [],
    allCompletions: allCompRes.data ?? [],
    myAssignment:   myAssignRes.data ?? null,
    allAssignments: allAssignRes.data ?? [],
  });
}
