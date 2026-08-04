import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { isSafeImageUrl } from '@/lib/sopSanitize';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { logError } from '@/lib/log';

// Only the canonical divisions may carry a photo — keeps the table from
// becoming an arbitrary key/value store.
const DIVISIONS = ['HVAC', 'Home Performance', 'Sales', 'Testing', 'Safety'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — every teammate needs these to render the dashboard tiles
  if (req.method === 'GET') {
    const { data, error } = await db.from('division_photos').select('division, image_url');
    if (error) {
      logError('divisions GET', error);
      return res.status(500).json({ error: 'Failed to load division photos. Make sure db/division_photos.sql has been run in Supabase.' });
    }
    const photos: Record<string, string> = {};
    for (const row of data ?? []) photos[row.division] = row.image_url;
    return res.status(200).json({ photos });
  }

  // PUT — admin only; an empty URL clears the photo
  if (req.method === 'PUT') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { division, imageUrl } = req.body ?? {};
    if (typeof division !== 'string' || !DIVISIONS.includes(division)) {
      return res.status(400).json({ error: 'Unknown division.' });
    }
    const url = normalizeImageUrl(String(imageUrl ?? ''));
    if (url && !isSafeImageUrl(url)) return res.status(400).json({ error: 'Invalid image URL.' });

    const { error } = await db.from('division_photos').upsert(
      { division, image_url: url, updated_by: session.name, updated_at: new Date().toISOString() },
      { onConflict: 'division' }
    );
    if (error) {
      logError('divisions PUT', error);
      return res.status(500).json({ error: 'Failed to save division photo.' });
    }
    return res.status(200).json({ ok: true, division, imageUrl: url });
  }

  return res.status(405).end();
}
