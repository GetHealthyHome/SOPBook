import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { logError } from '@/lib/log';
import { sanitize } from '@/lib/security';

const ALLOWED_DEPTS = ['Home Performance', 'HVAC'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  const db = getSupabase();
  const body = req.body ?? {};

  // POST — create a track (career ladder level/section)
  if (req.method === 'POST') {
    const cleanName = sanitize(String(body.name ?? ''), 'title');
    if (!cleanName) return res.status(400).json({ error: 'Track name required.' });
    if (!ALLOWED_DEPTS.includes(body.department)) return res.status(400).json({ error: 'Invalid department.' });

    const { data, error } = await db
      .from('career_tracks')
      .insert({
        name:        cleanName,
        description: sanitize(String(body.description ?? ''), 'summary'),
        department:  body.department,
        order_index: typeof body.orderIndex === 'number' ? body.orderIndex : 0,
      })
      .select().single();

    if (error) {
      logError('career/track POST', error);
      return res.status(500).json({ error: 'Insert failed.' });
    }
    return res.status(201).json({ track: data });
  }

  // PUT — update a track's name/description/order
  if (req.method === 'PUT') {
    const { trackId } = body;
    if (typeof trackId !== 'number') return res.status(400).json({ error: 'trackId required.' });
    const cleanName = sanitize(String(body.name ?? ''), 'title');
    if (!cleanName) return res.status(400).json({ error: 'Track name required.' });

    const updates: Record<string, unknown> = {
      name:        cleanName,
      description: sanitize(String(body.description ?? ''), 'summary'),
    };
    if (typeof body.orderIndex === 'number') updates.order_index = body.orderIndex;

    const { data, error } = await db
      .from('career_tracks')
      .update(updates)
      .eq('id', trackId)
      .select().single();

    if (error) {
      logError('career/track PUT', error);
      return res.status(500).json({ error: 'Update failed.' });
    }
    return res.status(200).json({ track: data });
  }

  // DELETE — remove a track and everything hanging off it
  if (req.method === 'DELETE') {
    const { trackId } = body;
    if (typeof trackId !== 'number') return res.status(400).json({ error: 'trackId required.' });

    // Cascade: completions for the track's tasks, then tasks, then
    // assignments pointing at the track, then the track itself.
    const { data: tasks, error: tasksErr } = await db
      .from('career_tasks').select('id').eq('track_id', trackId);
    if (tasksErr) {
      logError('career/track DELETE list-tasks', tasksErr);
      return res.status(500).json({ error: 'Delete failed.' });
    }
    const taskIds = (tasks ?? []).map((t: { id: number }) => t.id);

    if (taskIds.length) {
      const { error } = await db.from('career_completions').delete().in('task_id', taskIds);
      if (error) {
        logError('career/track DELETE completions', error);
        return res.status(500).json({ error: 'Delete failed.' });
      }
    }
    for (const [table, col] of [['career_tasks', 'track_id'], ['career_assignments', 'track_id'], ['career_tracks', 'id']] as const) {
      const { error } = await db.from(table).delete().eq(col, trackId);
      if (error) {
        logError(`career/track DELETE ${table}`, error);
        return res.status(500).json({ error: 'Delete failed.' });
      }
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
