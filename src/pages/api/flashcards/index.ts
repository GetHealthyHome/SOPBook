import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { logError } from '@/lib/log';

/**
 * Flashcards — a scenario on the front, the answer on the back.
 *
 * Everyone signed in can read them; only admins author them. Both sides keep
 * their rich-text markers, which are rendered as React elements and never as
 * HTML, exactly like SOP and safety content.
 */

const MAX_CARDS = 500;

function cleanCard(body: Record<string, unknown>) {
  const scenario = sanitize(String(body.scenario ?? ''), 'body');
  if (!scenario.trim()) return null;
  return {
    scenario,
    answer:   sanitize(String(body.answer ?? ''), 'article'),
    category: sanitize(String(body.category ?? ''), 'name'),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('flashcards')
      .select('*')
      .order('order_index')
      .order('created_at');
    if (error) {
      logError('flashcards GET', error);
      return res.status(500).json({ error: 'Failed to load flashcards. Make sure db/flashcards.sql has been run in Supabase.' });
    }
    return res.status(200).json({ cards: data ?? [] });
  }

  // Authoring is admin-only.
  if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });
  const body = req.body ?? {};

  if (req.method === 'POST') {
    const row = cleanCard(body);
    if (!row) return res.status(400).json({ error: 'Write the scenario for the front of the card.' });

    const { count } = await db.from('flashcards').select('*', { count: 'exact', head: true });
    if ((count ?? 0) >= MAX_CARDS) return res.status(400).json({ error: 'Flashcard limit reached.' });

    const { data, error } = await db
      .from('flashcards')
      // Authorship comes from the verified session, never the request body.
      .insert({ ...row, created_by: session.name, order_index: count ?? 0 })
      .select().single();
    if (error) {
      logError('flashcards POST', error);
      return res.status(500).json({ error: 'Failed to create the card.' });
    }
    return res.status(201).json({ card: data });
  }

  if (req.method === 'PUT') {
    if (typeof body.id !== 'number') return res.status(400).json({ error: 'id required.' });
    const row = cleanCard(body);
    if (!row) return res.status(400).json({ error: 'Write the scenario for the front of the card.' });

    const { data, error } = await db
      .from('flashcards')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .select().single();
    if (error) {
      logError('flashcards PUT', error);
      return res.status(500).json({ error: 'Failed to update the card.' });
    }
    return res.status(200).json({ card: data });
  }

  if (req.method === 'DELETE') {
    if (typeof body.id !== 'number') return res.status(400).json({ error: 'id required.' });
    const { error } = await db.from('flashcards').delete().eq('id', body.id);
    if (error) {
      logError('flashcards DELETE', error);
      return res.status(500).json({ error: 'Delete failed.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
