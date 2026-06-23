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

  const db = getSupabase();

  // GET — all SOPs
  if (req.method === 'GET') {
    const { data, error } = await db.from('sops').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to load SOPs.' });
    return res.status(200).json({ sops: (data ?? []).map(toClient) });
  }

  // POST — create new SOP (admin only)
  if (req.method === 'POST') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { id, category, title, summary, lastUpdated, lastUpdatedBy, lastUpdatedByRole,
            nextReviewDate, tools, materials, steps, revisionHistory, readLogs } = req.body ?? {};

    if (!id || !title) return res.status(400).json({ error: 'id and title required.' });

    const { data, error } = await db.from('sops').insert({
      id,
      category:             sanitize(String(category ?? ''), 'title'),
      title:                sanitize(String(title), 'title'),
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
    }).select().single();

    if (error) return res.status(500).json({ error: 'Failed to create SOP.' });
    return res.status(201).json({ sop: toClient(data) });
  }

  return res.status(405).end();
}
