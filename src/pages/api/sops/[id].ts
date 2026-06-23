import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';

function toClient(row: Record<string, unknown>) {
  return {
    id:                 row.id,
    category:           row.category,
    title:              row.title,
    summary:            row.summary,
    lastUpdated:        row.last_updated,
    lastUpdatedBy:      row.last_updated_by,
    lastUpdatedByRole:  row.last_updated_by_role,
    nextReviewDate:     row.next_review_date,
    tools:              row.tools ?? '',
    materials:          row.materials ?? '',
    steps:              row.steps ?? [],
    revisionHistory:    row.revision_history ?? [],
    readLogs:           row.read_logs ?? [],
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid id.' });

  const db = getSupabase();

  // PUT — update an SOP (add revision, mark read, edit content) — admin for edits
  if (req.method === 'PUT') {
    const body = req.body ?? {};

    // Read-log update: any authenticated user can add their own read log
    if (body.readLogOnly) {
      const { data: current, error: fetchErr } = await db.from('sops').select('read_logs').eq('id', id).single();
      if (fetchErr || !current) return res.status(404).json({ error: 'SOP not found.' });

      const existing: unknown[] = current.read_logs ?? [];
      const newLog = body.newLog;
      const updated = [newLog, ...existing];

      const { data, error } = await db.from('sops').update({ read_logs: updated }).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: 'Failed to update read log.' });
      return res.status(200).json({ sop: toClient(data) });
    }

    // Full update: admin only
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const { category, title, summary, lastUpdated, lastUpdatedBy, lastUpdatedByRole,
            nextReviewDate, tools, materials, steps, revisionHistory, readLogs } = body;

    const { data, error } = await db.from('sops').update({
      category:             sanitize(String(category ?? ''), 'title'),
      title:                sanitize(String(title ?? ''), 'title'),
      summary:              sanitize(String(summary ?? ''), 'summary'),
      last_updated:         String(lastUpdated ?? ''),
      last_updated_by:      String(lastUpdatedBy ?? ''),
      last_updated_by_role: String(lastUpdatedByRole ?? ''),
      next_review_date:     String(nextReviewDate ?? ''),
      tools:                sanitize(String(tools ?? ''), 'notes'),
      materials:            sanitize(String(materials ?? ''), 'notes'),
      steps:                steps ?? [],
      revision_history:     revisionHistory ?? [],
      read_logs:            readLogs ?? [],
    }).eq('id', id).select().single();

    if (error) return res.status(500).json({ error: 'Failed to update SOP.' });
    return res.status(200).json({ sop: toClient(data) });
  }

  // DELETE — admin only
  if (req.method === 'DELETE') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { error } = await db.from('sops').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete SOP.' });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
