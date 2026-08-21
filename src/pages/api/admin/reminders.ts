import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { handbookContentHash } from '@/lib/handbookHash';
import { sendBatch, reminderMessage, isEmailConfigured, appUrl, MAX_BATCH } from '@/lib/email';
import { recordEmail } from '@/lib/emailLog';
import { logError } from '@/lib/log';

/**
 * Acknowledgement chasing.
 *
 * GET  — every SOP and handbook section that somebody still owes a sign-off
 *        on, and exactly who owes it.
 * POST — email those people.
 *
 * "Outstanding" always means *at the current version*. An SOP that someone
 * signed off two revisions ago counts as outstanding again, which is the
 * whole point: the reminder exists because the content changed under them.
 */

interface Member {
  name: string;
  email: string;
  division: string;
}

interface OutstandingItem {
  kind: 'sop' | 'handbook';
  id: string;
  title: string;
  /** Divisions this item is tagged with. Empty means it applies to everyone. */
  divisions: string[];
  /** The version or content hash people are being asked to acknowledge. */
  version: string;
  outstanding: Member[];
  /** Members who are outstanding but have no address to send to. */
  unreachable: string[];
  lastRemindedAt: string | null;
}

const sopVersion = (revisionHistory: unknown): string => {
  const first = Array.isArray(revisionHistory) ? revisionHistory[0] : null;
  const v = first && typeof first === 'object' ? (first as { version?: unknown }).version : null;
  return typeof v === 'string' && v ? v : 'v1.0';
};

async function loadMembers(): Promise<{ all: Member[]; unreachable: Set<string> } | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from('app_users')
    .select('name, email, division, password_hash')
    .order('name');
  if (error) {
    logError('admin/reminders members', error);
    return null;
  }
  const all: Member[] = [];
  const unreachable = new Set<string>();
  for (const row of data ?? []) {
    // Somebody who has never set a password cannot acknowledge anything yet;
    // they need an invitation, not a reminder about an SOP they cannot open.
    if (!row.password_hash) continue;
    const email = String(row.email ?? '').trim();
    const member = { name: row.name, email, division: String(row.division ?? '') };
    if (!email) unreachable.add(row.name);
    all.push(member);
  }
  return { all, unreachable };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });

  const db = getSupabase();

  if (req.method === 'GET') {
    const members = await loadMembers();
    if (!members) return res.status(500).json({ error: 'Failed to load the team.' });

    const [sopsRes, sectionsRes, acksRes, lastRes] = await Promise.all([
      db.from('sops').select('id, title, categories, category, revision_history, read_logs'),
      db.from('handbook_sections').select('id, title, content, order_index').order('order_index'),
      db.from('handbook_acknowledgements').select('section_id, user_name, content_hash'),
      db.from('email_log').select('user_name, subject, created_at').eq('kind', 'reminder')
        .order('created_at', { ascending: false }).limit(500),
    ]);

    for (const [label, r] of [['sops', sopsRes], ['sections', sectionsRes], ['acks', acksRes]] as const) {
      if (r.error) {
        logError(`admin/reminders ${label}`, r.error);
        return res.status(500).json({ error: 'Failed to work out who still owes a sign-off.' });
      }
    }
    if (lastRes.error) logError('admin/reminders email_log', lastRes.error);

    // Most recent reminder per subject line, used to show "last chased on…".
    const lastBySubject = new Map<string, string>();
    for (const row of lastRes.data ?? []) {
      if (!lastBySubject.has(row.subject)) lastBySubject.set(row.subject, row.created_at);
    }
    const lastFor = (title: string) => lastBySubject.get(`Please acknowledge: ${title}`.slice(0, 180)) ?? null;

    const items: OutstandingItem[] = [];

    for (const sop of sopsRes.data ?? []) {
      const version = sopVersion(sop.revision_history);
      const logs = Array.isArray(sop.read_logs) ? sop.read_logs : [];
      const signed = new Set(
        logs
          .filter((l: { versionRead?: string }) => l?.versionRead === version)
          .map((l: { userName?: string }) => l?.userName),
      );
      const behind = members.all.filter(m => !signed.has(m.name));
      if (!behind.length) continue;
      const divisions: string[] = Array.isArray(sop.categories) && sop.categories.length
        ? sop.categories
        : (sop.category ? [sop.category] : []);
      items.push({
        kind: 'sop',
        id: String(sop.id),
        title: String(sop.title ?? 'Untitled procedure'),
        divisions,
        version,
        outstanding:  behind.filter(m => m.email),
        unreachable:  behind.filter(m => !m.email).map(m => m.name),
        lastRemindedAt: lastFor(String(sop.title ?? '')),
      });
    }

    // Acknowledgements carry the hash of what was acknowledged, so an edit
    // silently invalidates them — matching on the current hash is what makes
    // "re-acknowledge after a change" work.
    const ackBySection = new Map<string, Map<string, string>>();
    for (const a of acksRes.data ?? []) {
      let m = ackBySection.get(a.section_id);
      if (!m) { m = new Map(); ackBySection.set(a.section_id, m); }
      m.set(a.user_name, a.content_hash);
    }

    for (const section of sectionsRes.data ?? []) {
      const hash = handbookContentHash(String(section.title ?? ''), String(section.content ?? ''));
      const acks = ackBySection.get(section.id) ?? new Map<string, string>();
      const behind = members.all.filter(m => acks.get(m.name) !== hash);
      if (!behind.length) continue;
      items.push({
        kind: 'handbook',
        id: String(section.id),
        title: String(section.title ?? 'Untitled section'),
        divisions: [],  // the handbook applies to everyone
        version: hash.slice(0, 8),
        outstanding: behind.filter(m => m.email),
        unreachable: behind.filter(m => !m.email).map(m => m.name),
        lastRemindedAt: lastFor(String(section.title ?? '')),
      });
    }

    // Worst first — the thing most people are behind on is the thing to chase.
    items.sort((a, b) => (b.outstanding.length + b.unreachable.length) - (a.outstanding.length + a.unreachable.length));

    return res.status(200).json({
      items,
      emailConfigured: isEmailConfigured(),
      membersMissingEmail: Array.from(members.unreachable),
      maxBatch: MAX_BATCH,
    });
  }

  if (req.method === 'POST') {
    const { kind, id, scope, note } = req.body ?? {};
    if (kind !== 'sop' && kind !== 'handbook') return res.status(400).json({ error: 'kind must be sop or handbook.' });
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required.' });
    if (scope !== 'all' && scope !== 'division') return res.status(400).json({ error: 'scope must be all or division.' });
    if (!isEmailConfigured()) {
      return res.status(400).json({ error: 'Email is not set up yet, so reminders cannot be sent. Add the SMTP settings in your hosting environment first.' });
    }
    const cleanNote = sanitize(String(note ?? ''), 'notes').slice(0, 500);

    const members = await loadMembers();
    if (!members) return res.status(500).json({ error: 'Failed to load the team.' });

    let title = '';
    let divisions: string[] = [];
    let behind: Member[] = [];

    if (kind === 'sop') {
      const { data: sop, error } = await db
        .from('sops').select('id, title, categories, category, revision_history, read_logs')
        .eq('id', id).maybeSingle();
      if (error) {
        logError('admin/reminders POST sop', error);
        return res.status(500).json({ error: 'Failed to send reminders.' });
      }
      if (!sop) return res.status(404).json({ error: 'No such procedure.' });
      title = String(sop.title ?? '');
      divisions = Array.isArray(sop.categories) && sop.categories.length
        ? sop.categories
        : (sop.category ? [sop.category] : []);
      const version = sopVersion(sop.revision_history);
      const logs = Array.isArray(sop.read_logs) ? sop.read_logs : [];
      const signed = new Set(
        logs.filter((l: { versionRead?: string }) => l?.versionRead === version)
            .map((l: { userName?: string }) => l?.userName),
      );
      behind = members.all.filter(m => !signed.has(m.name));
    } else {
      const { data: section, error } = await db
        .from('handbook_sections').select('id, title, content').eq('id', id).maybeSingle();
      if (error) {
        logError('admin/reminders POST section', error);
        return res.status(500).json({ error: 'Failed to send reminders.' });
      }
      if (!section) return res.status(404).json({ error: 'No such handbook section.' });
      title = String(section.title ?? '');
      const hash = handbookContentHash(title, String(section.content ?? ''));
      const { data: acks, error: ackErr } = await db
        .from('handbook_acknowledgements').select('user_name, content_hash').eq('section_id', id);
      if (ackErr) {
        logError('admin/reminders POST acks', ackErr);
        return res.status(500).json({ error: 'Failed to send reminders.' });
      }
      const current = new Map((acks ?? []).map((a: { user_name: string; content_hash: string }) => [a.user_name, a.content_hash]));
      behind = members.all.filter(m => current.get(m.name) !== hash);
    }

    // Division scope only narrows when the item is actually tagged with one.
    // An untagged SOP has no division to scope to, so "their division" and
    // "everyone" mean the same thing and it would be misleading to pretend
    // otherwise by silently sending to nobody.
    let inScope = behind;
    let scopeApplied: 'all' | 'division' = 'all';
    if (scope === 'division' && divisions.length) {
      inScope = behind.filter(m => m.division && divisions.includes(m.division));
      scopeApplied = 'division';
    }
    const recipients = inScope.filter(m => m.email);
    const skippedNoEmail = inScope.filter(m => !m.email).map(m => m.name);

    // Two different reasons produce an empty send, and saying the wrong one
    // sends an admin looking for a missing email address that is not the
    // problem. Distinguish them.
    if (!recipients.length) {
      const where = scopeApplied === 'division' ? `in ${divisions.join('/')}` : 'on the team';
      return res.status(400).json({
        error: inScope.length
          ? `Everyone ${where} who still owes a sign-off has no email address on file: ${skippedNoEmail.join(', ')}. Add one on the Team tab first.`
          : `Nobody ${where} is behind on this, so there is no one to remind.`,
        skippedNoEmail,
      });
    }
    if (recipients.length > MAX_BATCH) {
      return res.status(400).json({ error: `That would email ${recipients.length} people at once. Hosted mailboxes throttle above roughly ${MAX_BATCH}; narrow it by division and send in groups.` });
    }

    const link = appUrl();
    const messages = recipients.map(m => reminderMessage({
      to: m.email, name: m.name, itemTitle: title, itemKind: kind,
      note: cleanNote, link, sentBy: session.name,
    }));
    const results = await sendBatch(messages);

    await recordEmail(recipients.map((m, i) => ({
      toEmail: m.email, userName: m.name, kind: 'reminder' as const,
      subject: messages[i].subject, result: results[i], sentBy: session.name,
    })));

    // Pair each recipient with their own result by index before filtering —
    // filtering first and re-indexing would attach the wrong error to the
    // wrong person.
    const paired = recipients.map((m, i) => ({ name: m.name, result: results[i] }));
    const sent   = paired.filter(p => p.result.status === 'sent').length;
    const failed = paired
      .filter(p => p.result.status !== 'sent')
      .map(p => ({ name: p.name, detail: p.result.detail }));

    return res.status(200).json({
      sent,
      total: recipients.length,
      scopeApplied,
      recipients: recipients.map(m => m.name),
      failed,
      skippedNoEmail,
    });
  }

  return res.status(405).end();
}
