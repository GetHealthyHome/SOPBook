import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { createToken, setSessionCookie, checkIpRateLimit } from '@/lib/serverAuth';

// Preset accounts — server-side only, never sent to the browser
const ACCOUNTS: Record<string, { role: string; userType: 'admin' | 'user'; pwHash: string }> = {};

const SALT = 'sop_auth_salt_2026_v1';
function sha256(value: string): string {
  return crypto.createHash('sha256').update(SALT + value).digest('hex');
}

// Build the account table once at module load (server start)
const RAW: [string, string, 'admin' | 'user', string][] = [
  ['Marcus Thorne', 'HVAC Supervisor',      'admin', 'marcusPassword'],
  ['Sarah Lin',     'Master Electrician',   'admin', 'sarahPassword'],
  ['Alex Rivers',   'Field Apprentice',     'user',  'alexPassword'],
  ['Derrick Vance', 'Plumbing Specialist',  'user',  'derrickPassword'],
];
for (const [name, role, userType, pw] of RAW) {
  ACCOUNTS[name.toLowerCase()] = { role, userType, pwHash: sha256(pw) };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // IP-level rate limiting — 10 attempts per minute per IP
  if (!checkIpRateLimit(req)) {
    return res.status(429).json({ error: 'Too many requests. Please wait.' });
  }

  const { name, password } = req.body ?? {};
  if (typeof name !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  const key = name.trim().toLowerCase();
  const account = ACCOUNTS[key];

  // Use constant-time comparison to prevent timing-based enumeration
  const entered = sha256(password);
  const stored = account?.pwHash ?? sha256('__invalid__');
  const match = crypto.timingSafeEqual(Buffer.from(entered, 'hex'), Buffer.from(stored, 'hex'));

  if (!account || !match) {
    // Same response for "not found" and "wrong password" — prevents user enumeration
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const displayName = RAW.find(r => r[0].toLowerCase() === key)![0];
  const token = createToken({ name: displayName, role: account.role, userType: account.userType });
  setSessionCookie(res, token);

  return res.status(200).json({
    user: { name: displayName, role: account.role, userType: account.userType },
  });
}
