import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { handbookContentHash } from '@/lib/handbookHash';
import { loadMembers, loadOutstanding, sopVersion, type Member } from '@/lib/outstanding';
import { sendBatch, reminderMessage, isEmailConfigured, appUrl, MAX_BATCH } from '@/lib/email';
import { recordEmail } from '@/lib/emailLog';
import { logError } from '@/lib/log';

/**
 * Chasing one specific item by hand.
 *
 * GET  — every SOP and handbook section somebody still owes a sign-off on.
 * POST — email the people behind on one of them, now.
 *
 * The routine case is the scheduled run in /api/cron/reminders, which sends a
 * single digest per person. This route stays for the case that schedule does
 * not cover: a revision that cannot wait for the next run. Both share the same
 * "who is behind" implementation so they can never disagree.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });

  const db = getSupabase();

  if (req.method === 'GET') {
    const members = await loadMembers();
    if (!members) return res.status(500).json({ error: 'Failed to load the team.' });

    const items = await loadOutstanding(members.all);
    if (!items) return res.status(500).json({ error: 'Failed to work out who still owes a sign-off.' });

    return res.status(200).json({
      items,
      emailConfigured: isEmailConfigured(),
      membersMissingEmail: members.unreachable,
      maxBatch: MAX_BATCH,
    });
  }

  if (req.method === 'POST') {
    const { kind, id, scope, note } = req.body ?? {};
    if (kind !== 'sop' && kind !== 'handbook') return res.status(400).json({ error: 'kind must be sop or handbook.' });
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required.' });
    if (scope !== 'all' && scope !== 'division') return res.status(400).json({ error: 'scope must be all or division.' });
    if (!isEmailConfigured()) {
      return res.status(400).json({ error: 'Email is not set up yet, so reminders cannot be sent. Add RESEND_API_KEY and EMAIL_FROM in your hosting environment first.' });
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
