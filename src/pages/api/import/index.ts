import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { isSafeImageUrl } from '@/lib/sopSanitize';
import { normalizeImageUrl } from '@/lib/imageUrl';
import {
  TEMPLATES, IMPORT_KINDS, parseFlashcards, parseSafety, parseTraining, type ImportKind,
} from '@/lib/importTemplates';
import { logError } from '@/lib/log';

/**
 * Bulk import from a filled-in template.
 *
 * Two properties matter more than anything else here:
 *
 *   1. **Nothing is written until the whole file parses.** A file that is half
 *      good does not leave half a deck of flashcards behind for someone to
 *      find and clean up by hand.
 *   2. **Rows go through exactly the same cleaning as the single-record forms.**
 *      A bulk path that skips sanitising would be a way around every check the
 *      normal path makes.
 *
 * Rows that cannot be used are reported by spreadsheet row number rather than
 * silently dropped, so a typo is findable.
 */

/** The largest file worth accepting. Comfortably above any real template. */
const MAX_BYTES = 2 * 1024 * 1024;

function isSafeLinkUrl(url: string): boolean {
  if (!url || url.length > 500) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

const cleanImage = (u: string) => {
  const n = normalizeImageUrl(u);
  return isSafeImageUrl(n) ? n : '';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });

  const { kind, csv, mode } = req.body ?? {};
  if (!IMPORT_KINDS.includes(kind)) {
    return res.status(400).json({ error: `Unknown import type. Choose one of: ${IMPORT_KINDS.join(', ')}.` });
  }
  if (typeof csv !== 'string' || !csv.trim()) {
    return res.status(400).json({ error: 'The file is empty.' });
  }
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) {
    return res.status(400).json({ error: 'That file is too large. Split it into smaller batches.' });
  }
  // A dry run reports exactly what would happen and writes nothing, so an
  // admin can check a file before committing to it.
  const dryRun = mode === 'preview';

  const spec = TEMPLATES[kind as ImportKind];
  const db = getSupabase();

  try {
    if (kind === 'flashcards') {
      const { records, problems } = parseFlashcards(csv);
      if (!records.length) return res.status(400).json({ error: whyNothing(problems), problems });
      if (records.length > spec.maxRecords) {
        return res.status(400).json({ error: `That file has ${records.length} cards; the limit is ${spec.maxRecords} at a time.`, problems });
      }
      if (dryRun) return res.status(200).json({ preview: true, count: records.length, problems, sample: records.slice(0, 3) });

      const { count } = await db.from('flashcards').select('*', { count: 'exact', head: true });
      const start = count ?? 0;
      if (start + records.length > spec.maxRecords) {
        return res.status(400).json({ error: `There are already ${start} cards. Importing ${records.length} more would pass the ${spec.maxRecords} limit.`, problems });
      }

      const rows = records.map((r, i) => ({
        scenario:    sanitize(r.scenario, 'body'),
        answer:      sanitize(r.answer, 'article'),
        category:    sanitize(r.category, 'name'),
        order_index: start + i,
        created_by:  session.name,
      }));
      const { error } = await db.from('flashcards').insert(rows);
      if (error) {
        logError('import flashcards', error);
        return res.status(500).json({ error: 'Failed to save the cards. Nothing was imported.', problems });
      }
      return res.status(200).json({ imported: rows.length, problems });
    }

    if (kind === 'safety') {
      const { records, problems } = parseSafety(csv);
      if (!records.length) return res.status(400).json({ error: whyNothing(problems), problems });
      if (records.length > spec.maxRecords) {
        return res.status(400).json({ error: `That file has ${records.length} modules; the limit is ${spec.maxRecords} at a time.`, problems });
      }
      if (dryRun) return res.status(200).json({ preview: true, count: records.length, problems, sample: records.slice(0, 3) });

      const { count } = await db.from('safety_modules').select('*', { count: 'exact', head: true });
      const start = count ?? 0;
      if (start + records.length > spec.maxRecords) {
        return res.status(400).json({ error: `There are already ${start} safety modules. Importing ${records.length} more would pass the ${spec.maxRecords} limit.`, problems });
      }

      const rows = records.map((r, i) => ({
        title:       sanitize(r.title, 'title'),
        body:        sanitize(r.body, 'article'),
        image_url:   cleanImage(r.imageUrl),
        link_url:    isSafeLinkUrl(r.linkUrl.trim()) ? r.linkUrl.trim() : '',
        link_label:  sanitize(r.linkLabel, 'title'),
        order_index: start + i,
        created_by:  session.name,
      }));
      const { error } = await db.from('safety_modules').insert(rows);
      if (error) {
        logError('import safety', error);
        return res.status(500).json({ error: 'Failed to save the modules. Nothing was imported.', problems });
      }
      return res.status(200).json({ imported: rows.length, problems });
    }

    // Training
    const { records, problems } = parseTraining(csv);
    if (!records.length) return res.status(400).json({ error: whyNothing(problems), problems });
    if (records.length > spec.maxRecords) {
      return res.status(400).json({ error: `That file has ${records.length} modules; the limit is ${spec.maxRecords} at a time.`, problems });
    }
    if (dryRun) {
      return res.status(200).json({
        preview: true,
        count: records.length,
        problems,
        sample: records.slice(0, 3).map(m => ({ title: m.title, category: m.category, steps: m.steps.length })),
      });
    }

    const { data: inserted, error: modErr } = await db
      .from('training_modules')
      .insert(records.map((m, i) => ({
        title:       sanitize(m.title, 'title'),
        description: sanitize(m.description, 'summary'),
        category:    m.category,
        cover_url:   cleanImage(m.coverUrl),
        order_index: i,
        created_by:  session.name,
      })))
      .select('id, title');
    if (modErr || !inserted) {
      logError('import training modules', modErr);
      return res.status(500).json({ error: 'Failed to save the modules. Nothing was imported.', problems });
    }

    // Insert order is preserved, so pair by position rather than by title —
    // two modules could legitimately share a name.
    const steps = records.flatMap((m, i) =>
      m.steps.map((s, j) => ({
        module_id:  inserted[i].id,
        title:      sanitize(s.title, 'title'),
        body:       sanitize(s.body, 'body'),
        image_urls: s.imageUrls.map(cleanImage).filter(Boolean),
        link_url:   isSafeLinkUrl(s.linkUrl.trim()) ? s.linkUrl.trim() : '',
        link_label: sanitize(s.linkLabel, 'title'),
        order_index: j,
      })));

    const { error: stepErr } = await db.from('training_steps').insert(steps);
    if (stepErr) {
      logError('import training steps', stepErr);
      // Modules with no steps are useless and confusing, so take them back
      // out rather than leaving empty shells behind.
      const { error: cleanupErr } = await db
        .from('training_modules')
        .delete()
        .in('id', inserted.map((m: { id: number }) => m.id));
      if (cleanupErr) logError('import training rollback', cleanupErr);
      return res.status(500).json({ error: 'Failed to save the steps, so the modules were rolled back. Nothing was imported.', problems });
    }

    return res.status(200).json({ imported: inserted.length, steps: steps.length, problems });
  } catch (err) {
    logError('import', err);
    return res.status(500).json({ error: 'Could not read that file. Check it is a CSV saved from the template.' });
  }
}

/** Say why an import produced nothing, using the parser's own findings. */
function whyNothing(problems: string[]): string {
  if (!problems.length) return 'There were no rows to import — the file has headers but no data.';
  return `Nothing could be imported. ${problems[0]}`;
}
