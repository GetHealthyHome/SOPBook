import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { logError } from '@/lib/log';

/**
 * The catalogue of badge types.
 *
 * Everyone signed in can read it — the chips render from it. Only admins can
 * add or remove a type.
 */

/** Palette keys the client knows how to style. */
export const BADGE_COLOURS = [
  'red', 'orange', 'amber', 'yellow', 'emerald', 'teal', 'blue', 'purple', 'gray',
] as const;

const MAX_TYPES = 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('badge_types')
      .select('*')
      .order('order_index')
      .order('name');
    if (error) {
      logError('badge types GET', error);
      return res.status(500).json({ error: 'Failed to load badge types. Make sure db/badge_types.sql has been run in Supabase.' });
    }
    return res.status(200).json({ types: data ?? [] });
  }

  if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });

  if (req.method === 'POST') {
    const name = sanitize(String(req.body?.name ?? ''), 'name');
    if (!name) return res.status(400).json({ error: 'Give the badge a name.' });
    const colour = BADGE_COLOURS.includes(req.body?.colour) ? req.body.colour : 'gray';

    const { count } = await db.from('badge_types').select('*', { count: 'exact', head: true });
    if ((count ?? 0) >= MAX_TYPES) {
      return res.status(400).json({ error: 'Badge limit reached.' });
    }

    const { data, error } = await db
      .from('badge_types')
      .insert({ name, colour, order_index: count ?? 0, created_by: session.name })
      .select().single();
    if (error) {
      // 23505 is a unique violation — the name already exists.
      if (error.code === '23505') return res.status(409).json({ error: 'A badge with that name already exists.' });
      logError('badge types POST', error);
      return res.status(500).json({ error: 'Failed to create the badge.' });
    }
    return res.status(201).json({ type: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (typeof id !== 'number') return res.status(400).json({ error: 'id required.' });

    const { data: type, error: findErr } = await db
      .from('badge_types').select('name').eq('id', id).maybeSingle();
    if (findErr) {
      logError('badge types DELETE lookup', findErr);
      return res.status(500).json({ error: 'Failed to load that badge.' });
    }
    if (!type) return res.status(404).json({ error: 'Badge not found.' });

    // Refuse rather than cascade. Silently stripping a certification off
    // everyone who holds it is not something a delete button should do, and
    // those assignments are the record of who is qualified for what.
    const { count, error: countErr } = await db
      .from('user_badges').select('*', { count: 'exact', head: true }).eq('badge', type.name);
    if (countErr) {
      logError('badge types DELETE count', countErr);
      return res.status(500).json({ error: 'Failed to check the badge.' });
    }
    if ((count ?? 0) > 0) {
      return res.status(409).json({
        error: `${count} ${count === 1 ? 'person holds' : 'people hold'} this badge. Remove it from them first.`,
      });
    }

    const { error } = await db.from('badge_types').delete().eq('id', id);
    if (error) {
      logError('badge types DELETE', error);
      return res.status(500).json({ error: 'Delete failed.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
