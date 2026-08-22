import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { buildTemplate, TEMPLATES, IMPORT_KINDS, type ImportKind } from '@/lib/importTemplates';

/**
 * Download a blank spreadsheet for bulk import.
 *
 * Admin-only, not because the file is secret — it is headers and examples —
 * but because only an admin can do anything with it, and an endpoint that
 * anyone can hit is one more thing to think about.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });

  const kind = String(req.query.kind ?? '') as ImportKind;
  if (!IMPORT_KINDS.includes(kind)) {
    return res.status(400).json({ error: `Unknown template. Choose one of: ${IMPORT_KINDS.join(', ')}.` });
  }

  const spec = TEMPLATES[kind];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  // The filename is from a fixed table, never from the request, so there is
  // nothing here that a crafted query could inject into the header.
  res.setHeader('Content-Disposition', `attachment; filename="${spec.filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(buildTemplate(kind));
}
