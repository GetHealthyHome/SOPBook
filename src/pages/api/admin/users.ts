import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit, isCurrentAdmin } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { sanitize, normalizeEmail, isValidEmail } from '@/lib/security';
import { hashPassword, verifyPassword, MAX_PASSWORD_LEN } from '@/lib/passwords';
import { DIVISIONS, sendInvite } from '@/lib/team';
import { logError } from '@/lib/log';

function toClient(row: Record<string, unknown>) {
  return {
    name:      row.name,
    role:      row.role,
    userType:  row.user_type,
    email:     row.email ?? '',
    division:  row.division ?? '',
    // Never expose the hash itself — only whether they have finished setting up.
    pending:   !row.password_hash,
    createdAt: row.created_at ?? null,
  };
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
      .select('name, role, user_type, email, division, password_hash, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      logError('admin/users GET', error);
      return res.status(500).json({ error: 'Failed to load users.' });
    }
    return res.status(200).json({ users: (data ?? []).map(toClient), divisions: DIVISIONS });
  }

  // POST — add a new team member (admin only)
  //
  // No password is set here. The member receives a single-use link and
  // chooses their own, so an admin never knows anyone else's password and
  // there is no temporary credential to leak or forget to rotate.
  if (req.method === 'POST') {
    if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });
    const { name, role, userType, email, division } = req.body ?? {};
    if (!name || !role || !userType) return res.status(400).json({ error: 'name, role and userType are required.' });
    if (!['admin', 'user'].includes(userType)) return res.status(400).json({ error: 'Invalid userType.' });

    const cleanName = sanitize(String(name), 'name');
    if (!cleanName) return res.status(400).json({ error: 'Invalid name.' });
    // The sign-in name is the person's first and last name, so insist on both.
    if (!/\s/.test(cleanName)) return res.status(400).json({ error: 'Use the member’s first and last name — that is what they sign in with.' });

    const cleanEmail = normalizeEmail(email);
    if (!isValidEmail(cleanEmail)) return res.status(400).json({ error: 'A valid email address is required — that is where the invitation goes.' });

    const cleanDivision = sanitize(String(division ?? ''), 'name');
    if (cleanDivision && !DIVISIONS.includes(cleanDivision)) return res.status(400).json({ error: 'Unknown division.' });

    const { data, error } = await db.from('app_users').insert({
      name:      cleanName,
      role:      sanitize(String(role), 'name'),
      user_type: userType,
      email:     cleanEmail,
      division:  cleanDivision || null,
      // Left null on purpose: no password until they set one from the invite.
      password_hash: null,
    }).select('name, role, user_type, email, division, password_hash, created_at').single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: /email/i.test(error.message)
            ? 'Someone already has that email address.'
            : 'A team member with that name already exists.',
        });
      }
      logError('admin/users POST', error);
      return res.status(500).json({ error: 'Failed to create the team member.' });
    }

    const invite = await sendInvite({ name: cleanName, email: cleanEmail, by: session.name, resend: false });
    return res.status(201).json({ user: toClient(data), invite });
  }

  // PUT — edit an existing member's details (admin only)
  if (req.method === 'PUT') {
    if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });
    const { name, role, userType, email, division } = req.body ?? {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required.' });

    const patch: Record<string, unknown> = {};
    if (role !== undefined) {
      const cleanRole = sanitize(String(role), 'name');
      if (!cleanRole) return res.status(400).json({ error: 'Role cannot be empty.' });
      patch.role = cleanRole;
    }
    if (userType !== undefined) {
      if (!['admin', 'user'].includes(userType)) return res.status(400).json({ error: 'Invalid userType.' });
      // Do not let an admin demote themselves and lock the console.
      if (name === session.name && userType !== 'admin') {
        return res.status(400).json({ error: 'You cannot remove your own admin access.' });
      }
      patch.user_type = userType;
    }
    if (email !== undefined) {
      const cleanEmail = normalizeEmail(email);
      if (!isValidEmail(cleanEmail)) return res.status(400).json({ error: 'That does not look like a valid email address.' });
      patch.email = cleanEmail;
    }
    if (division !== undefined) {
      const cleanDivision = sanitize(String(division ?? ''), 'name');
      if (cleanDivision && !DIVISIONS.includes(cleanDivision)) return res.status(400).json({ error: 'Unknown division.' });
      patch.division = cleanDivision || null;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' });

    const { data, error } = await db
      .from('app_users')
      .update(patch)
      .eq('name', name)
      .select('name, role, user_type, email, division, password_hash, created_at')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Someone already has that email address.' });
      logError('admin/users PUT', error);
      return res.status(500).json({ error: 'Failed to update the team member.' });
    }
    if (!data) return res.status(404).json({ error: 'No such team member.' });
    return res.status(200).json({ user: toClient(data) });
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
    if (name && typeof name === 'string' && (await isCurrentAdmin(session))) {
      const targetName = name;
      const { data: updated, error } = await db
        .from('app_users')
        .update({ password_hash: hashPassword(pw), session_epoch: Math.floor(Date.now() / 1000) })
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
      .update({ password_hash: hashPassword(pw), session_epoch: Math.floor(Date.now() / 1000) })
      .eq('name', session.name);
    if (chErr) {
      logError('admin/users PATCH self-change', chErr);
      return res.status(500).json({ error: 'Failed to change password.' });
    }
    return res.status(200).json({ ok: true });
  }

  // DELETE — remove a team member (admin only, cannot delete self)
  if (req.method === 'DELETE') {
    if (!(await isCurrentAdmin(session))) return res.status(403).json({ error: 'Admin only.' });
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
      // Any outstanding invite must die with the account, or the link would
      // recreate a password for a member who no longer exists.
      db.from('user_invites').delete().eq('user_name', name),
    ]);
    for (const c of cleanups) {
      if (c.error) logError('admin/users DELETE cleanup', c.error);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
