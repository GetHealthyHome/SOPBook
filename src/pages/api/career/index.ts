import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { logError } from '@/lib/log';

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
    // limit(1) instead of maybeSingle(): a stray duplicate assignment row
    // must not turn the whole career page into a 500
    db.from('career_assignments').select('*').eq('user_name', session.name).order('assigned_at', { ascending: false }).limit(1),
    isAdmin ? db.from('career_assignments').select('*') : Promise.resolve({ data: [], error: null }),
  ]);

  if (tracksRes.error) {
    logError('career GET tracks', tracksRes.error);
    return res.status(500).json({ error: 'Failed to load career tracks.' });
  }
  if (tasksRes.error) {
    logError('career GET tasks', tasksRes.error);
    return res.status(500).json({ error: 'Failed to load career tasks.' });
  }

  return res.status(200).json({
    tracks:         tracksRes.data ?? [],
    tasks:          tasksRes.data  ?? [],
    myCompletions:  myCompRes.data ?? [],
    allCompletions: allCompRes.data ?? [],
    myAssignment:   myAssignRes.data?.[0] ?? null,
    allAssignments: allAssignRes.data ?? [],
  });
}
