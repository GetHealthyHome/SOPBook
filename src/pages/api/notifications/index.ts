import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';

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
    const { data, error } = await db.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to load notifications.' });
    return res.status(200).json({ notifications: (data ?? []).map(toClient) });
  }

  // POST — create a notification (any authenticated user)
  if (req.method === 'POST') {
    const { id, docId, docTitle, suggestedBy, suggestedByRole, notes, timestamp } = req.body ?? {};
    if (!id || !notes) return res.status(400).json({ error: 'id and notes required.' });
    const { data, error } = await db.from('notifications').insert({
      id,
      doc_id:           docId,
      doc_title:        docTitle,
      suggested_by:     suggestedBy,
      suggested_by_role: suggestedByRole,
      notes:            sanitize(String(notes), 'notes'),
      timestamp,
    }).select().single();
    if (error) return res.status(500).json({ error: 'Failed to create notification.' });
    return res.status(201).json({ notification: toClient(data) });
  }

  // DELETE — dismiss a notification (admin only)
  if (req.method === 'DELETE') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required.' });
    const { error } = await db.from('notifications').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to dismiss notification.' });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
