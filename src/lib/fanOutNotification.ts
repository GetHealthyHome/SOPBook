import { getSupabase } from './supabaseServer';
import { logError } from './log';

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
