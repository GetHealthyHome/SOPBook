import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { hashPassword, verifyPassword, MAX_PASSWORD_LEN } from '@/lib/passwords';
import { logError } from '@/lib/log';

function toClient(row: Record<string, unknown>) {
  return { name: row.name, role: row.role, userType: row.user_type };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  const db = getSupabase();

  // GET — list all team members (any authenticated user, no password data)
  if (req.method === 'GET') {
    const { data, error } = await db
      .from('app_users')
      .select('name, role, user_type')
      .order('created_at', { ascending: true });
    if (error) {
      logError('admin/users GET', error);
      return res.status(500).json({ error: 'Failed to load users.' });
    }
    return res.status(200).json({ users: (data ?? []).map(toClient) });
  }

  // POST — add a new team member (admin only)
  if (req.method === 'POST') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { name, role, userType, password } = req.body ?? {};
    if (!name || !role || !userType || !password) return res.status(400).json({ error: 'name, role, userType, and password required.' });
    if (!['admin', 'user'].includes(userType)) return res.status(400).json({ error: 'Invalid userType.' });
    const pw = String(password);
    if (pw.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (pw.length > MAX_PASSWORD_LEN) return res.status(400).json({ error: 'Password too long.' });

    const cleanName = sanitize(String(name), 'name');
    if (!cleanName) return res.status(400).json({ error: 'Invalid name.' });

    const { data, error } = await db.from('app_users').insert({
      name:          cleanName,
      role:          sanitize(String(role), 'name'),
      user_type:     userType,
      password_hash: hashPassword(pw),
    }).select('name, role, user_type').single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A user with that name already exists.' });
      logError('admin/users POST', error);
      return res.status(500).json({ error: 'Failed to create user.' });
    }
    return res.status(201).json({ user: toClient(data) });
  }

  // PATCH — reset / change a password
  //   • Admin resetting another account: { name, newPassword, role?, userType? }
  //   • Anyone changing their own:        { currentPassword, newPassword }
  if (req.method === 'PATCH') {
    const { name, newPassword, currentPassword, role, userType } = req.body ?? {};
    const pw = String(newPassword ?? '');
    if (pw.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    if (pw.length > MAX_PASSWORD_LEN) return res.status(400).json({ error: 'Password too long.' });

    // Admin reset of a specific account (no current password needed)
    if (name && typeof name === 'string' && session.userType === 'admin') {
      const targetName = name;
      const { data: updated, error } = await db
        .from('app_users')
        .update({ password_hash: hashPassword(pw) })
        .eq('name', targetName)
        .select('name')
        .maybeSingle();
      if (error) {
        logError('admin/users PATCH reset', error);
        return res.status(500).json({ error: 'Failed to reset password.' });
      }
      // No DB row means this is an env-var preset account. Create a DB row
      // that takes over (login checks app_users before env fallbacks), as
      // long as we know the role/userType to store.
      if (!updated) {
        const cleanRole = sanitize(String(role ?? ''), 'name');
        if (!cleanRole || !['admin', 'user'].includes(userType)) {
          return res.status(404).json({ error: 'That account is not stored in the database. Include role and userType to create a reset for it.' });
        }
        const { error: insErr } = await db.from('app_users').insert({
          name: targetName,
          role: cleanRole,
          user_type: userType,
          password_hash: hashPassword(pw),
        });
        if (insErr) {
          logError('admin/users PATCH reset-insert', insErr);
          return res.status(500).json({ error: 'Failed to reset password.' });
        }
      }
      return res.status(200).json({ ok: true });
    }

    // Self-service change — verify the current password first
    const { data: me, error: meErr } = await db
      .from('app_users')
      .select('password_hash')
      .eq('name', session.name)
      .maybeSingle();
    if (meErr) {
      logError('admin/users PATCH self-lookup', meErr);
      return res.status(500).json({ error: 'Failed to change password.' });
    }
    if (!me) {
      return res.status(400).json({ error: 'Your account uses a preset password managed by an administrator; ask an admin to reset it.' });
    }
    if (!verifyPassword(String(currentPassword ?? ''), me.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const { error: chErr } = await db
      .from('app_users')
      .update({ password_hash: hashPassword(pw) })
      .eq('name', session.name);
    if (chErr) {
      logError('admin/users PATCH self-change', chErr);
      return res.status(500).json({ error: 'Failed to change password.' });
    }
    return res.status(200).json({ ok: true });
  }

  // DELETE — remove a team member (admin only, cannot delete self)
  if (req.method === 'DELETE') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required.' });
    if (name === session.name) return res.status(400).json({ error: 'Cannot delete your own account.' });
    const { error } = await db.from('app_users').delete().eq('name', name);
    if (error) {
      logError('admin/users DELETE', error);
      return res.status(500).json({ error: 'Failed to delete user.' });
    }
    // Clean up the user's related rows so no orphaned data lingers
    const cleanups = await Promise.all([
      db.from('user_badges').delete().eq('user_name', name),
      db.from('career_assignments').delete().eq('user_name', name),
      db.from('career_completions').delete().eq('user_name', name),
      db.from('user_notifications').delete().eq('user_name', name),
    ]);
    for (const c of cleanups) {
      if (c.error) logError('admin/users DELETE cleanup', c.error);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
