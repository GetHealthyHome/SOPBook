import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { isSafeImageUrl } from '@/lib/sopSanitize';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { notifyAdmins } from '@/lib/fanOutNotification';
import { logError } from '@/lib/log';

const CATEGORIES = ['injury', 'property', 'near_miss', 'vehicle', 'other'] as const;
const SEVERITIES = ['minor', 'moderate', 'major'] as const;
const STATUSES   = ['submitted', 'reviewing', 'closed'] as const;

// OSHA recordkeeping vocabularies — 29 CFR 1904, Form 300 columns G-M.
const OUTCOMES = ['', 'death', 'days_away', 'restricted', 'other'] as const;
const ILLNESS_TYPES = ['injury', 'skin', 'respiratory', 'poisoning', 'hearing', 'other'] as const;
const SEXES = ['', 'male', 'female'] as const;

const MAX_PHOTOS = 10;
const MAX_COST = 10_000_000; // whole dollars
const MAX_DAYS = 999;        // OSHA caps the day counts at 180; this is a sanity bound

function oneOf<T extends readonly string[]>(allowed: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

/** An ISO timestamp we are willing to store, or now. */
function safeTimestamp(value: unknown): string {
  if (typeof value !== 'string') return new Date().toISOString();
  const t = Date.parse(value);
  if (Number.isNaN(t)) return new Date().toISOString();
  // Reject anything implausible rather than storing a typo'd year.
  const now = Date.now();
  const tenYearsAgo = now - 10 * 365 * 24 * 60 * 60 * 1000;
  const tomorrow = now + 24 * 60 * 60 * 1000;
  if (t < tenYearsAgo || t > tomorrow) return new Date().toISOString();
  return new Date(t).toISOString();
}

function safePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_PHOTOS)
    .map(v => (typeof v === 'string' ? normalizeImageUrl(v) : ''))
    .filter(isSafeImageUrl);
}

function safeCost(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > MAX_COST) return null;
  return Math.round(n);
}

/** The factual account of the incident — what the filer writes. */
function cleanReport(body: Record<string, unknown>) {
  return {
    category:          oneOf(CATEGORIES, body.category, 'other'),
    severity:          oneOf(SEVERITIES, body.severity, 'minor'),
    osha_recordable:   body.oshaRecordable === true,
    occurred_at:       safeTimestamp(body.occurredAt),
    location:          sanitize(String(body.location ?? ''), 'title'),
    job_reference:     sanitize(String(body.jobReference ?? ''), 'title'),
    description:       sanitize(String(body.description ?? ''), 'article'),
    immediate_actions: sanitize(String(body.immediateActions ?? ''), 'body'),
    people_involved:   sanitize(String(body.peopleInvolved ?? ''), 'summary'),
    witnesses:         sanitize(String(body.witnesses ?? ''), 'summary'),
    photo_urls:        safePhotos(body.photoUrls),
    customer_notified: body.customerNotified === true,
    estimated_cost:    safeCost(body.estimatedCost),
  };
}

/** A date-only value (YYYY-MM-DD) or null. */
function safeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const t = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(t) ? null : value;
}

/** A 24-hour clock time, or ''. */
function safeTime(value: unknown): string {
  if (typeof value !== 'string') return '';
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function safeDays(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_DAYS, Math.round(n));
}

/**
 * The OSHA recordkeeping determination — admin-only, written during review.
 * Deliberately separate from cleanReport: the crew describe what happened,
 * management decide whether it is recordable and how it classifies.
 */
function cleanOshaFields(body: Record<string, unknown>) {
  return {
    osha_recordable:    body.oshaRecordable === true,
    osha_privacy_case:  body.oshaPrivacyCase === true,
    osha_case_number:   sanitize(String(body.oshaCaseNumber ?? ''), 'name') || null,

    employee_name:      sanitize(String(body.employeeName ?? ''), 'name'),
    employee_job_title: sanitize(String(body.employeeJobTitle ?? ''), 'name'),
    employee_address:   sanitize(String(body.employeeAddress ?? ''), 'summary'),
    employee_dob:       safeDate(body.employeeDob),
    employee_hire_date: safeDate(body.employeeHireDate),
    employee_sex:       oneOf(SEXES, body.employeeSex, ''),

    physician_name:     sanitize(String(body.physicianName ?? ''), 'name'),
    treatment_facility: sanitize(String(body.treatmentFacility ?? ''), 'summary'),
    treated_in_er:      body.treatedInEr === true,
    hospitalized:       body.hospitalized === true,

    time_began_work:    safeTime(body.timeBeganWork),
    time_of_event:      safeTime(body.timeOfEvent),
    activity_before:    sanitize(String(body.activityBefore ?? ''), 'body'),
    injury_description: sanitize(String(body.injuryDescription ?? ''), 'body'),
    harm_source:        sanitize(String(body.harmSource ?? ''), 'summary'),
    date_of_death:      safeDate(body.dateOfDeath),

    case_outcome:       oneOf(OUTCOMES, body.caseOutcome, ''),
    days_away:          safeDays(body.daysAway),
    days_restricted:    safeDays(body.daysRestricted),
    illness_type:       oneOf(ILLNESS_TYPES, body.illnessType, 'injury'),
  };
}

/** Non-admins never see the reviewer's private assessment. */
function forFiler(row: Record<string, unknown>) {
  const { review_notes: _omit, ...rest } = row;
  return rest;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();
  const admin = await isCurrentAdmin(session);

  // GET — admins see every report; everyone else sees only their own.
  if (req.method === 'GET') {
    const query = db
      .from('incident_reports')
      .select('*')
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    const { data, error } = admin ? await query : await query.eq('reported_by', session.name);
    if (error) {
      logError('incidents GET', error);
      return res.status(500).json({ error: 'Failed to load incident reports. Make sure db/incident_reports.sql has been run in Supabase.' });
    }
    const rows = data ?? [];
    return res.status(200).json({ reports: admin ? rows : rows.map(forFiler) });
  }

  // POST — anyone on the crew can file. This is the whole point of the
  // feature: the person who witnessed it is the person holding the phone.
  if (req.method === 'POST') {
    const row = cleanReport(req.body ?? {});
    if (!row.description.trim()) {
      return res.status(400).json({ error: 'Describe what happened before submitting.' });
    }

    const { data, error } = await db
      .from('incident_reports')
      // Provenance comes from the verified session, never the request body
      .insert({ ...row, reported_by: session.name, status: 'submitted' })
      .select().single();
    if (error) {
      logError('incidents POST', error);
      return res.status(500).json({ error: 'Failed to file the incident report.' });
    }

    // Best-effort: a report nobody sees is useless, but a notification
    // failure must never cost us the report itself.
    await notifyAdmins({
      type: 'incident',
      title: `Incident reported: ${row.category.replace('_', ' ')}`,
      message: `${session.name} filed a ${row.severity} incident report${row.location ? ` at ${row.location}` : ''}.`,
    }).catch(err => logError('incidents notify', err));

    return res.status(201).json({ report: forFiler(data) });
  }

  if (req.method === 'PUT') {
    const body = req.body ?? {};
    if (typeof body.id !== 'number') return res.status(400).json({ error: 'id required.' });

    const { data: existing, error: findErr } = await db
      .from('incident_reports')
      .select('id, reported_by, status')
      .eq('id', body.id)
      .maybeSingle();
    if (findErr) {
      logError('incidents PUT lookup', findErr);
      return res.status(500).json({ error: 'Failed to load that report.' });
    }
    if (!existing) return res.status(404).json({ error: 'Report not found.' });

    // --- Admin: may amend the facts and owns the entire review workflow ---
    if (admin) {
      const status = oneOf(STATUSES, body.status, existing.status as typeof STATUSES[number]);
      const osha = cleanOshaFields(body);
      const patch: Record<string, unknown> = {
        ...cleanReport(body),
        // The recordkeeping determination is management's, so it is applied
        // after the factual fields and overrides the filer's own tick.
        ...osha,
        status,
        review_notes:      sanitize(String(body.reviewNotes ?? ''), 'article'),
        corrective_action: sanitize(String(body.correctiveAction ?? ''), 'body'),
        updated_at:        new Date().toISOString(),
      };
      // Stamp who reviewed it the moment it leaves the filer's hands.
      if (status !== 'submitted' && existing.status === 'submitted') {
        patch.reviewed_by = session.name;
        patch.reviewed_at = new Date().toISOString();
      }
      patch.closed_at = status === 'closed' ? new Date().toISOString() : null;

      // A recordable case needs a case number for the Log's column (A). Assign
      // the next sequential one for the year the incident occurred in, so the
      // numbering follows the log rather than the order of data entry.
      if (osha.osha_recordable && !osha.osha_case_number) {
        const year = new Date(String(patch.occurred_at ?? existing.occurred_at)).getUTCFullYear();
        const { data: peers, error: peerErr } = await db
          .from('incident_reports')
          .select('osha_case_number')
          .not('osha_case_number', 'is', null)
          .like('osha_case_number', `${year}-%`);
        if (peerErr) {
          logError('incidents case-number', peerErr);
        } else {
          const highest = (peers ?? []).reduce((max: number, r: { osha_case_number: string | null }) => {
            const n = Number(String(r.osha_case_number ?? '').split('-')[1]);
            return Number.isFinite(n) && n > max ? n : max;
          }, 0);
          patch.osha_case_number = `${year}-${String(highest + 1).padStart(3, '0')}`;
        }
      }
      if (osha.osha_recordable) {
        patch.osha_determined_by = session.name;
        patch.osha_determined_at = new Date().toISOString();
      }

      const { data, error } = await db
        .from('incident_reports').update(patch).eq('id', body.id).select().single();
      if (error) {
        logError('incidents PUT admin', error);
        return res.status(500).json({ error: 'Failed to update the report.' });
      }
      return res.status(200).json({ report: data });
    }

    // --- Filer: may correct their own report, but only before review ---
    if (existing.reported_by !== session.name) {
      return res.status(403).json({ error: 'You can only edit a report you filed.' });
    }
    if (existing.status !== 'submitted') {
      return res.status(403).json({
        error: 'This report is already under review and can no longer be edited. Add anything further through your supervisor.',
      });
    }

    const { data, error } = await db
      .from('incident_reports')
      // Note what is absent: status, review_notes, corrective_action and
      // reported_by are all unreachable from this path.
      .update({ ...cleanReport(body), updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('reported_by', session.name)
      .select().single();
    if (error) {
      logError('incidents PUT filer', error);
      return res.status(500).json({ error: 'Failed to update the report.' });
    }
    return res.status(200).json({ report: forFiler(data) });
  }

  // DELETE — admin only. A filed incident is a record; crew members cannot
  // withdraw one they have second thoughts about.
  if (req.method === 'DELETE') {
    if (!admin) return res.status(403).json({ error: 'Admin only.' });
    const { id } = req.body ?? {};
    if (typeof id !== 'number') return res.status(400).json({ error: 'id required.' });
    const { error } = await db.from('incident_reports').delete().eq('id', id);
    if (error) {
      logError('incidents DELETE', error);
      return res.status(500).json({ error: 'Delete failed.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
