import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';
import { hashPassword, MAX_PASSWORD_LEN } from '@/lib/passwords';
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
