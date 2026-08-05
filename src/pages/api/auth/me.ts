import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, getLiveSession, clearSessionCookie, checkIpRateLimit } from '@/lib/serverAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  // Re-read the account rather than trusting the cookie's copy of it, so a
  // deletion, a demotion or a password reset ends the session here instead of
  // whenever the 8-hour token happens to expire. The role returned is the
  // current one, which is what the client uses to decide whether to show
  // admin controls.
  const live = await getLiveSession(session);
  if (!live) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
  }

  return res.status(200).json({ user: { name: live.name, role: live.role, userType: live.userType } });
}
