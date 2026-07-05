import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { logError } from '@/lib/log';
import { sanitize } from '@/lib/security';
import { isSafeImageUrl } from '@/lib/sopSanitize';

function cleanImageUrls(input: unknown): string[] {
  return Array.isArray(input)
    ? input.slice(0, 20).map((u: unknown) => String(u).trim()).filter(isSafeImageUrl)
    : [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  const db = getSupabase();
  const body = req.body ?? {};

  // POST — create a task (milestone) or sub-task (parentTaskId set)
  if (req.method === 'POST') {
    const { trackId, title, description, imageUrls, sopTitle, orderIndex, parentTaskId } = body;
    if (typeof trackId !== 'number') return res.status(400).json({ error: 'trackId required.' });
    const cleanTitle = sanitize(String(title ?? ''), 'title');
    if (!cleanTitle) return res.status(400).json({ error: 'Task title required.' });

    const row: Record<string, unknown> = {
      track_id:    trackId,
      title:       cleanTitle,
      description: sanitize(String(description ?? ''), 'notes'),
      image_urls:  cleanImageUrls(imageUrls),
      sop_title:   sanitize(String(sopTitle ?? ''), 'title'),
      order_index: typeof orderIndex === 'number' ? orderIndex : 0,
    };
    if (typeof parentTaskId === 'number') {
      // Sub-tasks nest one level deep: the parent must be a top-level
      // task in the same track.
      const { data: parent } = await db
        .from('career_tasks')
        .select('id, track_id, parent_task_id')
        .eq('id', parentTaskId)
        .maybeSingle();
      if (!parent || parent.track_id !== trackId) return res.status(400).json({ error: 'Parent task not found in this track.' });
      if (parent.parent_task_id) return res.status(400).json({ error: 'Sub-tasks cannot have their own sub-tasks.' });
      row.parent_task_id = parentTaskId;
    }

    const { data, error } = await db.from('career_tasks').insert(row).select().single();

    if (error) {
      logError('career/task POST', error);
      return res.status(500).json({ error: 'Insert failed. If you are adding a sub-task, make sure db/career_ladder_upgrade.sql has been run in Supabase.' });
    }
    return res.status(201).json({ task: data });
  }

  // PUT — update a milestone
  if (req.method === 'PUT') {
    const { taskId, title, description, imageUrls, sopTitle, orderIndex } = body;
    if (typeof taskId !== 'number') return res.status(400).json({ error: 'taskId required.' });
    const cleanTitle = sanitize(String(title ?? ''), 'title');
    if (!cleanTitle) return res.status(400).json({ error: 'Task title required.' });

    const updates: Record<string, unknown> = {
      title:       cleanTitle,
      description: sanitize(String(description ?? ''), 'notes'),
      image_urls:  cleanImageUrls(imageUrls),
      sop_title:   sanitize(String(sopTitle ?? ''), 'title'),
    };
    if (typeof orderIndex === 'number') updates.order_index = orderIndex;

    const { data, error } = await db
      .from('career_tasks')
      .update(updates)
      .eq('id', taskId)
      .select().single();

    if (error) {
      logError('career/task PUT', error);
      return res.status(500).json({ error: 'Update failed.' });
    }
    return res.status(200).json({ task: data });
  }

  // DELETE — remove a milestone, its sub-tasks, and their completion records
  if (req.method === 'DELETE') {
    const { taskId } = body;
    if (typeof taskId !== 'number') return res.status(400).json({ error: 'taskId required.' });

    // Collect sub-task ids; tolerate a database that predates the
    // parent_task_id migration (no sub-tasks can exist there).
    const { data: subs, error: subsErr } = await db
      .from('career_tasks').select('id').eq('parent_task_id', taskId);
    const ids = [taskId, ...(!subsErr && subs ? subs.map((s: { id: number }) => s.id) : [])];

    const { error: compErr } = await db.from('career_completions').delete().in('task_id', ids);
    if (compErr) {
      logError('career/task DELETE completions', compErr);
      return res.status(500).json({ error: 'Delete failed.' });
    }
    const { error } = await db.from('career_tasks').delete().in('id', ids);
    if (error) {
      logError('career/task DELETE', error);
      return res.status(500).json({ error: 'Delete failed.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
