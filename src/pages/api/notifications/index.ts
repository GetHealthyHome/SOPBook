import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { SOP_ID_RE } from '@/lib/sopSanitize';
import { logError } from '@/lib/log';

const NOTIF_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

function toClient(row: Record<string, unknown>) {
  return {
    id:               row.id,
    docId:            row.doc_id,
    docTitle:         row.doc_title,
    suggestedBy:      row.suggested_by,
    suggestedByRole:  row.suggested_by_role,
    notes:            row.notes,
    timestamp:        row.timestamp,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — all notifications (admin only)
  if (req.method === 'GET') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { data, error } = await db.from('notifications').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) {
      logError('notifications GET', error);
      return res.status(500).json({ error: 'Failed to load notifications.' });
    }
    return res.status(200).json({ notifications: (data ?? []).map(toClient) });
  }

  // POST — create a notification (any authenticated user)
  if (req.method === 'POST') {
    const { id, docId, docTitle, notes } = req.body ?? {};
    if (!id || !notes) return res.status(400).json({ error: 'id and notes required.' });
    if (typeof id !== 'string' || !NOTIF_ID_RE.test(id)) return res.status(400).json({ error: 'Invalid id.' });
    if (docId !== undefined && (typeof docId !== 'string' || !SOP_ID_RE.test(docId))) {
      return res.status(400).json({ error: 'Invalid docId.' });
    }
    const { data, error } = await db.from('notifications').insert({
      id,
      doc_id:            docId ?? null,
      doc_title:         sanitize(String(docTitle ?? ''), 'title'),
      // Identity comes from the verified session, never the request body
      suggested_by:      session.name,
      suggested_by_role: session.role,
      notes:             sanitize(String(notes), 'notes'),
      timestamp:         new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
    }).select().single();
    if (error) {
      logError('notifications POST', error);
      return res.status(500).json({ error: 'Failed to create notification.' });
    }
    return res.status(201).json({ notification: toClient(data) });
  }

  // DELETE — dismiss a notification (admin only)
  if (req.method === 'DELETE') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { id } = req.body ?? {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required.' });
    const { error } = await db.from('notifications').delete().eq('id', id);
    if (error) {
      logError('notifications DELETE', error);
      return res.status(500).json({ error: 'Failed to dismiss notification.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
