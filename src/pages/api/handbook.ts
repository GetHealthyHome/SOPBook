import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — return sections + revision history
  if (req.method === 'GET') {
    const [sectionsResult, revisionsResult] = await Promise.all([
      db.from('handbook_sections').select('id, title, content, order_index').order('order_index', { ascending: true }),
      db.from('handbook_revisions').select('*').order('edited_at', { ascending: false }).limit(100),
    ]);
    if (sectionsResult.error) return res.status(500).json({ error: 'Failed to load handbook.' });
    return res.status(200).json({
      sections: sectionsResult.data ?? [],
      revisions: session.userType === 'admin' ? (revisionsResult.data ?? []) : [],
    });
  }

  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  // POST — create a new section
  if (req.method === 'POST') {
    const { title, content, order_index, change_note } = req.body ?? {};
    if (!title || content === undefined) return res.status(400).json({ error: 'title and content required.' });

    const { data, error } = await db
      .from('handbook_sections')
      .insert({ title, content, order_index: order_index ?? 9999 })
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Failed to create section.' });

    await db.from('handbook_revisions').insert({
      section_id: data.id,
      section_title: title,
      previous_content: null,
      new_content: content,
      edited_by: session.name,
      change_note: change_note ?? 'Section created',
    });

    return res.status(201).json({ section: data });
  }

  // PUT — update an existing section
  if (req.method === 'PUT') {
    const { id, title, content, change_note } = req.body ?? {};
    if (!id || !title || content === undefined) return res.status(400).json({ error: 'id, title and content required.' });

    const { data: existing } = await db.from('handbook_sections').select('content').eq('id', id).single();

    const { data, error } = await db
      .from('handbook_sections')
      .update({ title, content })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Failed to update section.' });

    await db.from('handbook_revisions').insert({
      section_id: id,
      section_title: title,
      previous_content: existing?.content ?? null,
      new_content: content,
      edited_by: session.name,
      change_note: change_note ?? null,
    });

    return res.status(200).json({ section: data });
  }

  // DELETE — remove a section
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required.' });

    const { error } = await db.from('handbook_sections').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete section.' });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
