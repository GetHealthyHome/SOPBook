import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { sanitizeSteps, sanitizeRevisions, sanitizeReadLogs, sanitizeCategories, SOP_ID_RE, MAX_READ_LOGS } from '@/lib/sopSanitize';
import { fanOutNotification } from '@/lib/fanOutNotification';
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

  const { id } = req.query;
  if (typeof id !== 'string' || !SOP_ID_RE.test(id)) return res.status(400).json({ error: 'Invalid id.' });

  const db = getSupabase();

  // PUT — update an SOP (add revision, mark read, edit content) — admin for edits
  if (req.method === 'PUT') {
    const body = req.body ?? {};

    // Read-log update: any authenticated user can add their own read log.
    // The log entry is built server-side from the verified session so a
    // user can never write a read log under someone else's name.
    if (body.readLogOnly) {
      const { data: current, error: fetchErr } = await db.from('sops').select('*').eq('id', id).single();
      if (fetchErr || !current) return res.status(404).json({ error: 'SOP not found.' });

      const versionRead = sanitize(String(body.newLog?.versionRead ?? ''), 'default').slice(0, 20) || 'v1.0';
      const existing: { userName?: string; versionRead?: string }[] = Array.isArray(current.read_logs) ? current.read_logs : [];

      // Idempotent: one sign-off per user per version
      if (existing.some(l => l?.userName === session.name && l?.versionRead === versionRead)) {
        return res.status(200).json({ sop: toClient(current) });
      }

      const newLog = {
        userName:    session.name,
        userRole:    session.role,
        timestamp:   new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        versionRead,
      };
      const updated = [newLog, ...existing].slice(0, MAX_READ_LOGS);

      const { data, error } = await db.from('sops').update({ read_logs: updated }).eq('id', id).select().single();
      if (error) {
        logError('sops/[id] read-log', error);
        return res.status(500).json({ error: 'Failed to update read log.' });
      }
      return res.status(200).json({ sop: toClient(data) });
    }

    // Full update: admin only
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const { category, categories, title, summary, lastUpdated, nextReviewDate,
            tools, materials, steps, revisionHistory, readLogs } = body;

    const cleanTitle = sanitize(String(title ?? ''), 'title');
    const cleanCategories = sanitizeCategories(categories, category);

    const { data, error } = await db.from('sops').update({
      category:             cleanCategories[0] ?? '',
      categories:           cleanCategories,
      title:                cleanTitle,
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
      read_logs:            sanitizeReadLogs(readLogs),
    }).eq('id', id).select().single();

    if (error) {
      logError('sops/[id] PUT', error);
      return res.status(500).json({ error: 'Failed to update SOP.' });
    }

    // Fan out notification to all users about SOP update
    fanOutNotification({
      type: 'sop',
      title: `SOP Updated: ${cleanTitle}`,
      message: `${session.name} updated the SOP "${cleanTitle}". Review the latest revision.`,
      excludeUser: session.name,
    }).catch(err => logError('sops/[id] fan-out', err));

    return res.status(200).json({ sop: toClient(data) });
  }

  // DELETE — admin only
  if (req.method === 'DELETE') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { error } = await db.from('sops').delete().eq('id', id);
    if (error) {
      logError('sops/[id] DELETE', error);
      return res.status(500).json({ error: 'Failed to delete SOP.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
