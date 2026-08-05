import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { logError } from '@/lib/log';

/**
 * Training completion + admin validation, mirroring the career ladder's
 * milestone sign-off: a member marks a module complete (pending), an
 * admin validates it (PATCH) or rejects it (DELETE). Identity always
 * comes from the verified session.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // POST — member marks a training module complete (pending validation)
  if (req.method === 'POST') {
    const { moduleId } = req.body ?? {};
    if (typeof moduleId !== 'number') return res.status(400).json({ error: 'moduleId required.' });

    const [modRes, dupRes] = await Promise.all([
      db.from('training_modules').select('id').eq('id', moduleId).maybeSingle(),
      db.from('training_completions').select('*').eq('module_id', moduleId).eq('user_name', session.name).limit(1),
    ]);
    if (!modRes.data) return res.status(404).json({ error: 'Training module not found.' });
    if (dupRes.data?.length) return res.status(200).json({ completion: dupRes.data[0] }); // idempotent

    const { data, error } = await db.from('training_completions').insert({
      module_id: moduleId,
      user_name: session.name,
      user_role: session.role,
    }).select().single();

    if (error) {
      logError('training/complete POST', error);
      return res.status(500).json({ error: 'Failed to record completion. Make sure db/training_validation.sql has been run in Supabase.' });
    }
    return res.status(201).json({ completion: data });
  }

  // PATCH — admin validates a completion
  if (req.method === 'PATCH') {
    if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });
    const { completionId } = req.body ?? {};
    if (typeof completionId !== 'number') return res.status(400).json({ error: 'completionId required.' });

    const { data, error } = await db
      .from('training_completions')
      .update({ verified_by: session.name, verified_at: new Date().toISOString() })
      .eq('id', completionId)
      .select().single();

    if (error) {
      logError('training/complete PATCH', error);
      return res.status(500).json({ error: 'Validation failed.' });
    }
    return res.status(200).json({ completion: data });
  }

  // DELETE — owner un-marks a *pending* completion; admins can remove any
  // (rejecting it so the member must redo the training)
  if (req.method === 'DELETE') {
    const { completionId } = req.body ?? {};
    if (typeof completionId !== 'number') return res.status(400).json({ error: 'completionId required.' });

    const { data: existing } = await db.from('training_completions').select('*').eq('id', completionId).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Completion not found.' });

    const isOwner = existing.user_name === session.name;
    const isAdmin = await isCurrentAdmin(session);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden.' });
    if (isOwner && !isAdmin && existing.verified_by) {
      return res.status(403).json({ error: 'This completion is validated — only an admin can remove it.' });
    }

    const { error } = await db.from('training_completions').delete().eq('id', completionId);
    if (error) {
      logError('training/complete DELETE', error);
      return res.status(500).json({ error: 'Delete failed.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
