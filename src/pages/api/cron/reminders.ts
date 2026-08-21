import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { loadMembers, loadOutstanding } from '@/lib/outstanding';
import { parseSettings, isSendDay, pastGracePeriod, pastQuietPeriod } from '@/lib/reminderSchedule';
import { sendBatch, digestMessage, isEmailConfigured, appUrl, MAX_BATCH } from '@/lib/email';
import { recordEmail } from '@/lib/emailLog';
import { logError } from '@/lib/log';

/**
 * The scheduled reminder run.
 *
 * Called once a day by the hosting cron (see vercel.json). It works out who is
 * behind on what, decides whether today is a day the admin asked for, and
 * sends **one email per person** listing everything they owe.
 *
 * One-per-person is the whole point. Chasing each item separately would mean
 * somebody behind on four procedures gets four emails in one morning, which is
 * how a reminder system teaches people to ignore it.
 *
 * An admin can also run it on demand from the console, which sends to whoever
 * is due right now regardless of the day — useful after a big revision, and
 * the only way to see what the schedule will actually do without waiting.
 */

/** Constant-time compare so the secret cannot be guessed a byte at a time. */
function secretMatches(header: string | undefined): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const given = (header ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Two ways in, and nothing else: the platform's cron carrying CRON_SECRET,
  // or a signed-in admin pressing "Send now".
  const fromCron = secretMatches(req.headers.authorization);
  let manual = false;
  if (!fromCron) {
    if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
    const session = getSession(req);
    if (!session || !(await isCurrentAdmin(session))) {
      return res.status(401).json({ error: 'Not authorised.' });
    }
    manual = true;
  }
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  const now = new Date();
  const db = getSupabase();

  const { data: rows, error: settingsErr } = await db.from('app_settings').select('key, value');
  if (settingsErr) {
    logError('cron/reminders settings', settingsErr);
    return res.status(500).json({ error: 'Failed to read the reminder schedule.' });
  }
  const bag: Record<string, string> = {};
  for (const row of rows ?? []) bag[row.key] = row.value;
  const settings = parseSettings(bag);

  // A manual run ignores the calendar but still honours the quiet period, so
  // pressing the button twice does not send the same person two emails.
  if (!manual && !isSendDay(settings, now)) {
    return res.status(200).json({ ran: false, reason: 'Not a scheduled send day.', settings });
  }
  if (settings.frequency === 'off' && !manual) {
    return res.status(200).json({ ran: false, reason: 'Automatic reminders are off.', settings });
  }
  if (!isEmailConfigured()) {
    return res.status(200).json({ ran: false, reason: 'Email is not configured, so nothing was sent.', settings });
  }

  const members = await loadMembers();
  if (!members) return res.status(500).json({ error: 'Failed to load the team.' });

  const items = await loadOutstanding(members.all);
  if (!items) return res.status(500).json({ error: 'Failed to work out who still owes a sign-off.' });

  // When was each person last chased? This is what keeps a daily schedule
  // from becoming daily nagging.
  const { data: log, error: logErr } = await db
    .from('email_log')
    .select('user_name, created_at')
    .eq('kind', 'reminder')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (logErr) logError('cron/reminders log', logErr);
  const lastChased = new Map<string, string>();
  for (const row of log ?? []) {
    if (!lastChased.has(row.user_name)) lastChased.set(row.user_name, row.created_at);
  }

  // Build one list of owed items per person.
  const owed = new Map<string, { email: string; items: { title: string; kind: 'sop' | 'handbook' }[] }>();
  let skippedForGrace = 0;

  for (const item of items) {
    if (!pastGracePeriod(item.changedAt, settings.graceDays, now)) {
      skippedForGrace++;
      continue;
    }
    // Division scope only narrows when the item is actually tagged with one;
    // an untagged item has no division to scope to.
    const recipients = settings.scope === 'division' && item.divisions.length
      ? item.outstanding.filter(m => m.division && item.divisions.includes(m.division))
      : item.outstanding;

    for (const m of recipients) {
      if (!m.email) continue;
      let entry = owed.get(m.name);
      if (!entry) { entry = { email: m.email, items: [] }; owed.set(m.name, entry); }
      entry.items.push({ title: item.title, kind: item.kind });
    }
  }

  const quiet: string[] = [];
  const due: { name: string; email: string; items: { title: string; kind: 'sop' | 'handbook' }[] }[] = [];
  for (const [name, entry] of Array.from(owed.entries())) {
    if (!pastQuietPeriod(lastChased.get(name) ?? null, settings.quietDays, now)) {
      quiet.push(name);
      continue;
    }
    due.push({ name, email: entry.email, items: entry.items });
  }

  if (!due.length) {
    return res.status(200).json({
      ran: true, sent: 0, total: 0, settings,
      quietPeriodSkipped: quiet, skippedForGrace,
      membersMissingEmail: members.unreachable,
      reason: quiet.length
        ? 'Everyone who is behind was already reminded recently.'
        : 'Nobody is behind on anything.',
    });
  }

  // One person per message, so the batch size is people rather than items.
  const batch = due.slice(0, MAX_BATCH);
  const overflow = due.slice(MAX_BATCH).map(d => d.name);
  const link = appUrl();
  const messages = batch.map(d => digestMessage({ to: d.email, name: d.name, items: d.items, link }));
  const results = await sendBatch(messages);

  await recordEmail(batch.map((d, i) => ({
    toEmail: d.email, userName: d.name, kind: 'reminder' as const,
    subject: messages[i].subject, result: results[i],
    sentBy: manual ? 'admin (run now)' : 'scheduled',
  })));

  const paired = batch.map((d, i) => ({ name: d.name, result: results[i] }));
  return res.status(200).json({
    ran: true,
    manual,
    sent: paired.filter(p => p.result.status === 'sent').length,
    total: batch.length,
    recipients: batch.map(d => ({ name: d.name, items: d.items.length })),
    failed: paired.filter(p => p.result.status !== 'sent').map(p => ({ name: p.name, detail: p.result.detail })),
    quietPeriodSkipped: quiet,
    skippedForGrace,
    membersMissingEmail: members.unreachable,
    // Anyone past the per-run ceiling waits for the next run rather than being
    // dropped silently.
    deferredToNextRun: overflow,
    settings,
  });
}
