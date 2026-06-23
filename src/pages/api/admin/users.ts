import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize } from '@/lib/security';

const SALT = 'sop_auth_salt_2026_v1';
function hashPassword(pw: string): string {
  return crypto.createHash('sha256').update(SALT + pw).digest('hex');
}

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
    if (error) return res.status(500).json({ error: 'Failed to load users.' });
    return res.status(200).json({ users: (data ?? []).map(toClient) });
  }

  // POST — add a new team member (admin only)
  if (req.method === 'POST') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { name, role, userType, password } = req.body ?? {};
    if (!name || !role || !userType || !password) return res.status(400).json({ error: 'name, role, userType, and password required.' });
    if (!['admin', 'user'].includes(userType)) return res.status(400).json({ error: 'Invalid userType.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const { data, error } = await db.from('app_users').insert({
      name:          sanitize(String(name), 'title'),
      role:          sanitize(String(role), 'title'),
      user_type:     userType,
      password_hash: hashPassword(String(password)),
    }).select('name, role, user_type').single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A user with that name already exists.' });
      return res.status(500).json({ error: 'Failed to create user.' });
    }
    return res.status(201).json({ user: toClient(data) });
  }

  // DELETE — remove a team member (admin only, cannot delete self)
  if (req.method === 'DELETE') {
    if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { name } = req.body ?? {};
    if (!name) return res.status(400).json({ error: 'name required.' });
    if (name === session.name) return res.status(400).json({ error: 'Cannot delete your own account.' });
    const { error } = await db.from('app_users').delete().eq('name', name);
    if (error) return res.status(500).json({ error: 'Failed to delete user.' });
    // Clean up orphaned badge assignments for this user
    await db.from('user_badges').delete().eq('user_name', name);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
