import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { logError } from '@/lib/log';

// Only known settings may be written — prevents an arbitrary-key/value
// dumping ground in app_settings.
const ALLOWED_KEYS = ['notifications_enabled'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  const db = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await db.from('app_settings').select('key, value');
    if (error) {
      logError('admin/settings GET', error);
      return res.status(500).json({ error: 'Failed to load settings.' });
    }
    const settings: Record<string, string> = {};
    for (const row of data ?? []) settings[row.key] = row.value;
    return res.status(200).json({ settings });
  }

  if (req.method === 'PUT') {
    const { key, value } = req.body ?? {};
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value required.' });
    if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: 'Unknown setting.' });
    const { error } = await db.from('app_settings').upsert(
      { key, value: String(value).slice(0, 200), updated_by: session.name, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (error) {
      logError('admin/settings PUT', error);
      return res.status(500).json({ error: 'Failed to update setting.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
