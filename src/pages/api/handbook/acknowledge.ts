import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { handbookContentHash } from '@/lib/handbookHash';
import { logError } from '@/lib/log';

/**
 * A team member acknowledges that they have read a handbook section at
 * its current content. Identity comes from the verified session (never
 * the request body), and the content hash is computed server-side from
 * the live section — so an acknowledgement always reflects exactly what
 * the member saw, and can't be forged for someone else.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const { sectionId } = req.body ?? {};
  if (!sectionId || typeof sectionId !== 'string') return res.status(400).json({ error: 'sectionId required.' });

  const db = getSupabase();

  const { data: section, error: secErr } = await db
    .from('handbook_sections')
    .select('id, title, content')
    .eq('id', sectionId)
    .maybeSingle();
  if (secErr) {
    logError('handbook/acknowledge lookup', secErr);
    return res.status(500).json({ error: 'Failed to record acknowledgement.' });
  }
  if (!section) return res.status(404).json({ error: 'Section not found.' });

  const contentHash = handbookContentHash(section.title, section.content ?? '');

  const { data, error } = await db
    .from('handbook_acknowledgements')
    .upsert({
      section_id:      sectionId,
      user_name:       session.name,
      user_role:       session.role,
      content_hash:    contentHash,
      acknowledged_at: new Date().toISOString(),
    }, { onConflict: 'section_id,user_name' })
    .select()
    .single();

  if (error) {
    logError('handbook/acknowledge upsert', error);
    return res.status(500).json({ error: 'Failed to record acknowledgement. Make sure db/handbook_acknowledgements.sql has been run in Supabase.' });
  }
  return res.status(200).json({ acknowledgement: data });
}
