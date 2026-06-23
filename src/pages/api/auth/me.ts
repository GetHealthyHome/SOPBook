import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/serverAuth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  return res.status(200).json({ user: { name: session.name, role: session.role, userType: session.userType } });
}
