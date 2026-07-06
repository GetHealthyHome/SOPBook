import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { isSafeImageUrl } from '@/lib/sopSanitize';
import { logError } from '@/lib/log';

const CATEGORIES = ['Home Performance', 'HVAC'];
const MAX_STEPS = 50;
const MAX_IMAGES_PER_STEP = 10;

function isSafeLinkUrl(url: string): boolean {
  if (!url || url.length > 500) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

interface CleanStep {
  title: string;
  body: string;
  image_urls: string[];
  link_url: string;
  link_label: string;
  order_index: number;
}

function cleanSteps(input: unknown): CleanStep[] | null {
  if (!Array.isArray(input)) return [];
  const out: CleanStep[] = [];
  for (const raw of input.slice(0, MAX_STEPS)) {
    const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const title = sanitize(String(s.title ?? ''), 'title');
    if (!title) return null; // every step needs a title
    const linkUrl = typeof s.linkUrl === 'string' ? s.linkUrl.trim() : '';
    out.push({
      title,
      body: sanitize(String(s.body ?? ''), 'body'),
      image_urls: Array.isArray(s.imageUrls)
        ? s.imageUrls.slice(0, MAX_IMAGES_PER_STEP).map((u: unknown) => String(u).trim()).filter(isSafeImageUrl)
        : [],
      link_url: isSafeLinkUrl(linkUrl) ? linkUrl : '',
      link_label: sanitize(String(s.linkLabel ?? ''), 'title'),
      order_index: out.length,
    });
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — all training modules with their steps (any authenticated user)
  if (req.method === 'GET') {
    const [modsRes, stepsRes] = await Promise.all([
      db.from('training_modules').select('*').order('order_index').order('created_at'),
      db.from('training_steps').select('*').order('order_index'),
    ]);
    if (modsRes.error) {
      logError('training GET', modsRes.error);
      return res.status(500).json({ error: 'Failed to load training. Make sure db/training_modules.sql has been run in Supabase.' });
    }
    const steps = stepsRes.data ?? [];
    const modules = (modsRes.data ?? []).map((m: { id: number }) => ({
      ...m,
      steps: steps.filter((s: { module_id: number }) => s.module_id === m.id),
    }));
    return res.status(200).json({ modules });
  }

  // Everything below is admin-only authoring
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  const body = req.body ?? {};

  // POST — create a module with its steps
  if (req.method === 'POST' || req.method === 'PUT') {
    const title = sanitize(String(body.title ?? ''), 'title');
    if (!title) return res.status(400).json({ error: 'Title required.' });
    if (!CATEGORIES.includes(body.category)) return res.status(400).json({ error: 'Invalid category.' });
    const coverUrl = typeof body.coverUrl === 'string' && isSafeImageUrl(body.coverUrl.trim()) ? body.coverUrl.trim() : '';
    const steps = cleanSteps(body.steps);
    if (steps === null) return res.status(400).json({ error: 'Every step needs a title.' });
    if (!steps.length) return res.status(400).json({ error: 'At least one step is required.' });

    const moduleRow = {
      title,
      description: sanitize(String(body.description ?? ''), 'summary'),
      category:    body.category,
      cover_url:   coverUrl,
    };

    let moduleId: number;
    if (req.method === 'POST') {
      const { data, error } = await db
        .from('training_modules')
        .insert({ ...moduleRow, created_by: session.name })
        .select().single();
      if (error) {
        logError('training POST', error);
        return res.status(500).json({ error: 'Failed to create module. Make sure db/training_modules.sql has been run in Supabase.' });
      }
      moduleId = data.id;
    } else {
      if (typeof body.id !== 'number') return res.status(400).json({ error: 'id required.' });
      moduleId = body.id;
      const { error } = await db.from('training_modules').update(moduleRow).eq('id', moduleId);
      if (error) {
        logError('training PUT', error);
        return res.status(500).json({ error: 'Failed to update module.' });
      }
      // Replace-all step semantics keeps authoring simple
      const { error: delErr } = await db.from('training_steps').delete().eq('module_id', moduleId);
      if (delErr) {
        logError('training PUT clear-steps', delErr);
        return res.status(500).json({ error: 'Failed to update steps.' });
      }
    }

    const { error: stepsErr } = await db
      .from('training_steps')
      .insert(steps.map(s => ({ ...s, module_id: moduleId })));
    if (stepsErr) {
      logError('training steps insert', stepsErr);
      return res.status(500).json({ error: 'Failed to save steps.' });
    }

    const [{ data: mod }, { data: modSteps }] = await Promise.all([
      db.from('training_modules').select('*').eq('id', moduleId).single(),
      db.from('training_steps').select('*').eq('module_id', moduleId).order('order_index'),
    ]);
    return res.status(req.method === 'POST' ? 201 : 200).json({ module: { ...mod, steps: modSteps ?? [] } });
  }

  // DELETE — remove a module and its steps
  if (req.method === 'DELETE') {
    const { id } = body;
    if (typeof id !== 'number') return res.status(400).json({ error: 'id required.' });
    // Steps first (covers databases created without the FK cascade)
    const { error: stepsErr } = await db.from('training_steps').delete().eq('module_id', id);
    if (stepsErr) logError('training DELETE steps', stepsErr);
    const { error } = await db.from('training_modules').delete().eq('id', id);
    if (error) {
      logError('training DELETE', error);
      return res.status(500).json({ error: 'Delete failed.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
