import { getSupabase } from './supabaseServer';

export async function fanOutNotification(opts: {
  type: 'sop' | 'handbook';
  title: string;
  message: string;
  excludeUser?: string;
}) {
  const db = getSupabase();

  // Check global toggle
  const { data: setting } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'notifications_enabled')
    .single();
  if (setting?.value !== 'true') return;

  // Get all users
  const { data: users } = await db.from('app_users').select('name');
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
    await db.from('user_notifications').insert(rows);
  }
}
