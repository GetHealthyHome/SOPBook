/**
 * Who still owes a sign-off, and on what.
 *
 * Lives here rather than in the reminders route because two things need it —
 * the admin console's manual view and the scheduled run — and two copies of
 * "is this person behind?" would drift apart, which is exactly the kind of
 * bug nobody notices until someone is chased about a procedure they signed.
 *
 * Outstanding always means *at the current version*. An SOP signed off two
 * revisions ago counts as outstanding again, and a handbook section edited
 * after someone acknowledged it does too. That is the point: the reminder
 * exists because the content changed under them.
 */
import { getSupabase } from './supabaseServer';
import { handbookContentHash } from './handbookHash';
import { logError } from './log';

export interface Member {
  name: string;
  email: string;
  division: string;
}

export interface OutstandingItem {
  kind: 'sop' | 'handbook';
  id: string;
  title: string;
  /** Divisions this item is tagged with. Empty means it applies to everyone. */
  divisions: string[];
  /** The version or content hash people are being asked to acknowledge. */
  version: string;
  /** When the current version appeared, if it can be worked out. */
  changedAt: string | null;
  outstanding: Member[];
  /** Members who are outstanding but have no address to send to. */
  unreachable: string[];
  lastRemindedAt: string | null;
}

export const sopVersion = (revisionHistory: unknown): string => {
  const first = Array.isArray(revisionHistory) ? revisionHistory[0] : null;
  const v = first && typeof first === 'object' ? (first as { version?: unknown }).version : null;
  return typeof v === 'string' && v ? v : 'v1.0';
};

/**
 * SOP revision dates are stored as MM/DD/YYYY strings typed by whoever made
 * the edit, so parse defensively — an unreadable date means "no grace period
 * information", not a crash.
 */
export function sopRevisedAt(revisionHistory: unknown): string | null {
  const first = Array.isArray(revisionHistory) ? revisionHistory[0] : null;
  const raw = first && typeof first === 'object' ? (first as { date?: unknown }).date : null;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function loadMembers(): Promise<{ all: Member[]; unreachable: string[] } | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from('app_users')
    .select('name, email, division, password_hash')
    .order('name');
  if (error) {
    logError('outstanding/members', error);
    return null;
  }
  const all: Member[] = [];
  const unreachable: string[] = [];
  for (const row of data ?? []) {
    // Somebody who has never set a password cannot acknowledge anything yet;
    // they need an invitation, not a reminder about an SOP they cannot open.
    if (!row.password_hash) continue;
    const email = String(row.email ?? '').trim();
    if (!email) unreachable.push(row.name);
    all.push({ name: row.name, email, division: String(row.division ?? '') });
  }
  return { all, unreachable };
}

/** Every SOP and handbook section somebody still owes, worst first. */
export async function loadOutstanding(members: Member[]): Promise<OutstandingItem[] | null> {
  const db = getSupabase();
  const [sopsRes, sectionsRes, acksRes, lastRes] = await Promise.all([
    db.from('sops').select('id, title, categories, category, revision_history, read_logs'),
    db.from('handbook_sections').select('id, title, content, updated_at, order_index').order('order_index'),
    db.from('handbook_acknowledgements').select('section_id, user_name, content_hash'),
    db.from('email_log').select('user_name, subject, created_at').eq('kind', 'reminder')
      .order('created_at', { ascending: false }).limit(500),
  ]);

  for (const [label, r] of [['sops', sopsRes], ['sections', sectionsRes], ['acks', acksRes]] as const) {
    if (r.error) {
      logError(`outstanding/${label}`, r.error);
      return null;
    }
  }
  if (lastRes.error) logError('outstanding/email_log', lastRes.error);

  // Most recent reminder mentioning each title, used to show "last chased on…".
  const lastByTitle = new Map<string, string>();
  for (const row of lastRes.data ?? []) {
    const subject = String(row.subject ?? '');
    if (!lastByTitle.has(subject)) lastByTitle.set(subject, row.created_at);
  }
  const lastFor = (title: string) =>
    lastByTitle.get(`Please acknowledge: ${title}`.slice(0, 180)) ?? null;

  const items: OutstandingItem[] = [];

  for (const sop of sopsRes.data ?? []) {
    const version = sopVersion(sop.revision_history);
    const logs = Array.isArray(sop.read_logs) ? sop.read_logs : [];
    const signed = new Set(
      logs
        .filter((l: { versionRead?: string }) => l?.versionRead === version)
        .map((l: { userName?: string }) => l?.userName),
    );
    const behind = members.filter(m => !signed.has(m.name));
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
      changedAt: sopRevisedAt(sop.revision_history),
      outstanding: behind.filter(m => m.email),
      unreachable: behind.filter(m => !m.email).map(m => m.name),
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
    const behind = members.filter(m => acks.get(m.name) !== hash);
    if (!behind.length) continue;
    items.push({
      kind: 'handbook',
      id: String(section.id),
      title: String(section.title ?? 'Untitled section'),
      divisions: [],  // the handbook applies to everyone
      version: hash.slice(0, 8),
      changedAt: section.updated_at ?? null,
      outstanding: behind.filter(m => m.email),
      unreachable: behind.filter(m => !m.email).map(m => m.name),
      lastRemindedAt: lastFor(String(section.title ?? '')),
    });
  }

  // Worst first — the thing most people are behind on is the thing to chase.
  items.sort((a, b) =>
    (b.outstanding.length + b.unreachable.length) - (a.outstanding.length + a.unreachable.length));
  return items;
}
