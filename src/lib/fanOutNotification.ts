import { getSupabase } from './supabaseServer';
import { logError } from './log';

export type NotificationType = 'sop' | 'handbook' | 'incident';

/**
 * Notify administrators only. Used for incident reports, which carry injury
 * details and named individuals and so must not fan out to the whole crew.
 *
 * Deliberately best-effort: it never throws, because losing a notification is
 * survivable and losing the incident report that triggered it is not.
 */
export async function notifyAdmins(opts: {
  type: NotificationType;
  title: string;
  message: string;
}) {
  const db = getSupabase();
  const { data: admins, error } = await db
    .from('app_users')
    .select('name')
    .eq('user_type', 'admin');
  if (error) {
    logError('notifyAdmins lookup', error);
    return;
  }
  if (!admins?.length) return;

  const rows = admins.map((u: { name: string }) => ({
    user_name: u.name,
    type: opts.type,
    title: opts.title,
    message: opts.message,
  }));
  const { error: insertErr } = await db.from('user_notifications').insert(rows);
  // A CHECK constraint on `type` shows up here — see db/incident_reports.sql.
  if (insertErr) logError('notifyAdmins insert', insertErr);
}

export async function fanOutNotification(opts: {
  type: 'sop' | 'handbook';
  title: string;
  message: string;
  excludeUser?: string;
}) {
  const db = getSupabase();

  // Check global toggle
  const { data: setting, error: settingErr } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'notifications_enabled')
    .maybeSingle();
  if (settingErr) logError('fanOut settings', settingErr);
  if (setting?.value !== 'true') return;

  // Get all users
  const { data: users, error: usersErr } = await db.from('app_users').select('name');
  if (usersErr) {
    logError('fanOut users', usersErr);
    return;
  }
  if (!users?.length) return;

  const rows = users
    .filter((u: { name: string }) => u.name !== opts.excludeUser)
    .map((u: { name: string }) => ({
      user_name: u.name,
      type: opts.type,
      title: opts.title,
      message: opts.message,
    }));

  if (rows.length) {
    const { error } = await db.from('user_notifications').insert(rows);
    if (error) logError('fanOut insert', error);
  }
}
