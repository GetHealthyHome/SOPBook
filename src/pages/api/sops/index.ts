import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { sanitizeSteps, sanitizeRevisions, sanitizeReadLogs, sanitizeCategories, SOP_ID_RE } from '@/lib/sopSanitize';
import { logError } from '@/lib/log';

function toClient(row: Record<string, unknown>) {
  const categories = Array.isArray(row.categories) && row.categories.length
    ? row.categories
    : (row.category ? [row.category] : []);
  return {
    id:                 row.id,
    category:           row.category ?? (categories[0] ?? ''),
    categories,
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
    if (error) {
      logError('sops GET', error);
      return res.status(500).json({ error: 'Failed to load SOPs.' });
    }
    return res.status(200).json({ sops: (data ?? []).map(toClient) });
  }

  // POST — create new SOP (admin only)
  if (req.method === 'POST') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { id, category, categories, title, summary, lastUpdated, nextReviewDate,
            tools, materials, steps, revisionHistory } = req.body ?? {};

    if (!id || !title) return res.status(400).json({ error: 'id and title required.' });
    if (typeof id !== 'string' || !SOP_ID_RE.test(id)) return res.status(400).json({ error: 'Invalid id.' });

    const cleanCategories = sanitizeCategories(categories, category);

    const { data, error } = await db.from('sops').insert({
      id,
      category:             cleanCategories[0] ?? '',
      categories:           cleanCategories,
      title:                sanitize(String(title), 'title'),
      summary:              sanitize(String(summary ?? ''), 'summary'),
      last_updated:         sanitize(String(lastUpdated ?? ''), 'default').slice(0, 40),
      // Authorship comes from the verified session, never the request body
      last_updated_by:      session.name,
      last_updated_by_role: session.role,
      next_review_date:     sanitize(String(nextReviewDate ?? ''), 'default').slice(0, 40),
      tools:                sanitize(String(tools ?? ''), 'notes'),
      materials:            sanitize(String(materials ?? ''), 'notes'),
      steps:                sanitizeSteps(steps),
      revision_history:     sanitizeRevisions(revisionHistory),
      read_logs:            sanitizeReadLogs(req.body?.readLogs),
    }).select().single();

    if (error) {
      logError('sops POST', error);
      return res.status(500).json({ error: 'Failed to create SOP.' });
    }
    return res.status(201).json({ sop: toClient(data) });
  }

  return res.status(405).end();
}
