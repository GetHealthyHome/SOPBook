import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { fanOutNotification } from '@/lib/fanOutNotification';
import { handbookContentHash } from '@/lib/handbookHash';
import { logError } from '@/lib/log';

const MAX_CONTENT_LEN = 50_000;

interface HandbookSectionRow { id: string; title: string; content: string; order_index: number }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — return sections (+ current content hash), revisions, and
  // acknowledgements (all members for admins, own only for regular users)
  if (req.method === 'GET') {
    const isAdmin = session.userType === 'admin';
    const [sectionsResult, revisionsResult, acksResult] = await Promise.all([
      db.from('handbook_sections').select('id, title, content, order_index').order('order_index', { ascending: true }),
      isAdmin
        ? db.from('handbook_revisions').select('*').order('edited_at', { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null }),
      isAdmin
        ? db.from('handbook_acknowledgements').select('*')
        : db.from('handbook_acknowledgements').select('*').eq('user_name', session.name),
    ]);
    if (sectionsResult.error) {
      logError('handbook GET', sectionsResult.error);
      return res.status(500).json({ error: 'Failed to load handbook.' });
    }
    if (acksResult.error) logError('handbook GET acks', acksResult.error);

    const sections = (sectionsResult.data ?? []).map((s: HandbookSectionRow) => ({
      ...s,
      content_hash: handbookContentHash(s.title, s.content),
    }));

    return res.status(200).json({
      sections,
      revisions: revisionsResult.data ?? [],
      acknowledgements: acksResult.data ?? [],
    });
  }

  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  const body = req.body ?? {};
  const cleanTitle = sanitize(String(body.title ?? ''), 'title');
  const content = typeof body.content === 'string' ? body.content.slice(0, MAX_CONTENT_LEN) : undefined;
  const changeNote = body.change_note != null ? sanitize(String(body.change_note), 'notes') : null;

  // POST — create a new section
  if (req.method === 'POST') {
    if (!cleanTitle || content === undefined) return res.status(400).json({ error: 'title and content required.' });
    const orderIndex = typeof body.order_index === 'number' ? body.order_index : 9999;

    const { data, error } = await db
      .from('handbook_sections')
      .insert({ title: cleanTitle, content, order_index: orderIndex })
      .select()
      .single();
    if (error) {
      logError('handbook POST', error);
      return res.status(500).json({ error: 'Failed to create section.' });
    }

    const { error: revErr } = await db.from('handbook_revisions').insert({
      section_id: data.id,
      section_title: cleanTitle,
      previous_content: null,
      new_content: content,
      edited_by: session.name,
      change_note: changeNote ?? 'Section created',
    });
    if (revErr) logError('handbook POST revision', revErr);

    fanOutNotification({
      type: 'handbook',
      title: `Handbook Updated: ${cleanTitle}`,
      message: `A new section "${cleanTitle}" was added to the Employee Handbook by ${session.name}.`,
      excludeUser: session.name,
    }).catch(err => logError('handbook fan-out', err));

    return res.status(201).json({ section: data });
  }

  // PUT — update an existing section
  if (req.method === 'PUT') {
    const { id } = body;
    if (!id || !cleanTitle || content === undefined) return res.status(400).json({ error: 'id, title and content required.' });

    const { data: existing } = await db.from('handbook_sections').select('content').eq('id', id).maybeSingle();

    const { data, error } = await db
      .from('handbook_sections')
      .update({ title: cleanTitle, content })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      logError('handbook PUT', error);
      return res.status(500).json({ error: 'Failed to update section.' });
    }

    const { error: revErr } = await db.from('handbook_revisions').insert({
      section_id: id,
      section_title: cleanTitle,
      previous_content: existing?.content ?? null,
      new_content: content,
      edited_by: session.name,
      change_note: changeNote,
    });
    if (revErr) logError('handbook PUT revision', revErr);

    fanOutNotification({
      type: 'handbook',
      title: `Handbook Updated: ${cleanTitle}`,
      message: `The section "${cleanTitle}" was updated in the Employee Handbook by ${session.name}${changeNote ? ` — ${changeNote}` : ''}.`,
      excludeUser: session.name,
    }).catch(err => logError('handbook fan-out', err));

    return res.status(200).json({ section: data });
  }

  // DELETE — remove a section
  if (req.method === 'DELETE') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required.' });

    const { error } = await db.from('handbook_sections').delete().eq('id', id);
    if (error) {
      logError('handbook DELETE', error);
      return res.status(500).json({ error: 'Failed to delete section.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
