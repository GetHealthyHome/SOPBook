import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { isSafeImageUrl } from '@/lib/sopSanitize';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { logError } from '@/lib/log';

const MAX_MODULES = 200;

function isSafeLinkUrl(url: string): boolean {
  if (!url || url.length > 500) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Shape a request body into a storable row. Body text keeps its rich-text
 *  markers — it is rendered as React elements, never as HTML. */
function cleanModule(body: Record<string, unknown>) {
  const title = sanitize(String(body.title ?? ''), 'title');
  if (!title) return null;
  const image = normalizeImageUrl(String(body.imageUrl ?? ''));
  const link = String(body.linkUrl ?? '').trim();
  return {
    title,
    body:       sanitize(String(body.body ?? ''), 'article'),
    image_url:  isSafeImageUrl(image) ? image : '',
    link_url:   isSafeLinkUrl(link) ? link : '',
    link_label: sanitize(String(body.linkLabel ?? ''), 'title'),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — every authenticated teammate can read safety modules
  if (req.method === 'GET') {
    const { data, error } = await db
      .from('safety_modules')
      .select('*')
      .order('order_index')
      .order('created_at');
    if (error) {
      logError('safety GET', error);
      return res.status(500).json({ error: 'Failed to load safety modules. Make sure db/safety_modules.sql has been run in Supabase.' });
    }
    return res.status(200).json({ modules: data ?? [] });
  }

  // Everything below is admin-only authoring
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  const body = req.body ?? {};

  if (req.method === 'POST') {
    const row = cleanModule(body);
    if (!row) return res.status(400).json({ error: 'Title required.' });

    const { count } = await db.from('safety_modules').select('*', { count: 'exact', head: true });
    if ((count ?? 0) >= MAX_MODULES) {
      return res.status(400).json({ error: 'Safety module limit reached.' });
    }

    const { data, error } = await db
      .from('safety_modules')
      // Authorship comes from the verified session, never the request body
      .insert({ ...row, created_by: session.name, order_index: count ?? 0 })
      .select().single();
    if (error) {
      logError('safety POST', error);
      return res.status(500).json({ error: 'Failed to create safety module.' });
    }
    return res.status(201).json({ module: data });
  }

  if (req.method === 'PUT') {
    if (typeof body.id !== 'number') return res.status(400).json({ error: 'id required.' });
    const row = cleanModule(body);
    if (!row) return res.status(400).json({ error: 'Title required.' });

    const { data, error } = await db
      .from('safety_modules')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .select().single();
    if (error) {
      logError('safety PUT', error);
      return res.status(500).json({ error: 'Failed to update safety module.' });
    }
    return res.status(200).json({ module: data });
  }

  if (req.method === 'DELETE') {
    if (typeof body.id !== 'number') return res.status(400).json({ error: 'id required.' });
    const { error } = await db.from('safety_modules').delete().eq('id', body.id);
    if (error) {
      logError('safety DELETE', error);
      return res.status(500).json({ error: 'Delete failed.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
