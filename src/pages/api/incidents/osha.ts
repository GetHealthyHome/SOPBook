import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { buildForm300, buildForm300A, buildForm301, type Establishment, type OshaCase } from '@/lib/oshaForms';
import { logError } from '@/lib/log';

/**
 * OSHA recordkeeping forms as PDFs — 29 CFR Part 1904.
 *
 *   GET /api/incidents/osha?form=301&id=<case id>
 *   GET /api/incidents/osha?form=300&year=<yyyy>
 *   GET /api/incidents/osha?form=300A&year=<yyyy>
 *
 * The 300 log and the 300A summary are admin-only: they aggregate medical
 * information across the whole crew.
 *
 * The 301 is admin-only with one deliberate exception. 1904.35(b)(2) gives an
 * employee the right to a copy of the 301 describing their own injury, by the
 * end of the next business day. Making them ask an admin for it is a worse
 * experience and a worse compliance posture than letting them download it, so
 * a filer may fetch the 301 for a case that is their own.
 */

function settingsToEstablishment(s: Record<string, string>): Establishment {
  return {
    name:               s.osha_establishment_name   ?? '',
    street:             s.osha_establishment_street ?? '',
    city:               s.osha_establishment_city   ?? '',
    state:              s.osha_establishment_state  ?? '',
    zip:                s.osha_establishment_zip    ?? '',
    industry:           s.osha_industry_description ?? '',
    naics:              s.osha_naics                ?? '',
    annualAvgEmployees: s.osha_annual_avg_employees ?? '',
    totalHoursWorked:   s.osha_total_hours_worked   ?? '',
    executiveName:      s.osha_executive_name       ?? '',
    executiveTitle:     s.osha_executive_title      ?? '',
    executivePhone:     s.osha_executive_phone      ?? '',
  };
}

function sendPdf(res: NextApiResponse, bytes: Uint8Array, filename: string) {
  res.setHeader('Content-Type', 'application/pdf');
  // A safe, quoted ASCII filename — these end up in email and shared folders.
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
  res.setHeader('Content-Length', String(bytes.length));
  // Never cached: these carry medical information.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return res.status(200).send(Buffer.from(bytes));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();
  const admin = await isCurrentAdmin(session);
  const form = String(req.query.form ?? '').toLowerCase();

  // Establishment details drive every form header.
  const { data: settingRows, error: settingsErr } = await db.from('app_settings').select('key, value');
  if (settingsErr) {
    logError('osha settings', settingsErr);
    return res.status(500).json({ error: 'Failed to load establishment details.' });
  }
  const settings: Record<string, string> = {};
  for (const row of settingRows ?? []) settings[row.key] = row.value;
  const establishment = settingsToEstablishment(settings);

  // ---- Form 301: one case -------------------------------------------------
  if (form === '301') {
    const id = Number(req.query.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'A numeric id is required.' });

    const { data, error } = await db.from('incident_reports').select('*').eq('id', id).maybeSingle();
    if (error) {
      logError('osha 301 lookup', error);
      return res.status(500).json({ error: 'Failed to load that case.' });
    }
    if (!data) return res.status(404).json({ error: 'Case not found.' });

    // Admins, or the employee this record is about.
    const isOwnCase = data.reported_by === session.name || data.employee_name === session.name;
    if (!admin && !isOwnCase) return res.status(403).json({ error: 'Admin only.' });

    const bytes = await buildForm301(data as OshaCase, establishment);
    return sendPdf(res, bytes, `OSHA-301-${data.osha_case_number ?? `case-${data.id}`}.pdf`);
  }

  // ---- Forms 300 and 300A: the whole log for a year, admin only -----------
  if (form === '300' || form === '300a') {
    if (!admin) return res.status(403).json({ error: 'Admin only.' });

    const now = new Date();
    const year = Number(req.query.year) || now.getUTCFullYear();
    if (year < 2000 || year > now.getUTCFullYear() + 1) {
      return res.status(400).json({ error: 'Year out of range.' });
    }
    const from = new Date(Date.UTC(year, 0, 1)).toISOString();
    const to   = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

    const { data, error } = await db
      .from('incident_reports')
      .select('*')
      .eq('osha_recordable', true)
      .gte('occurred_at', from)
      .lt('occurred_at', to)
      .order('occurred_at', { ascending: true });
    if (error) {
      logError('osha log', error);
      return res.status(500).json({ error: 'Failed to load the log. Make sure db/osha_recordkeeping.sql has been run in Supabase.' });
    }

    const cases = (data ?? []) as OshaCase[];
    if (form === '300') {
      return sendPdf(res, await buildForm300(cases, year, establishment), `OSHA-300-Log-${year}.pdf`);
    }
    // The 300A must be produced even for a year with no cases — that is the
    // point of the posting requirement, so an empty list is not an error.
    return sendPdf(res, await buildForm300A(cases, year, establishment), `OSHA-300A-Summary-${year}.pdf`);
  }

  return res.status(400).json({ error: 'form must be 301, 300 or 300A.' });
}
