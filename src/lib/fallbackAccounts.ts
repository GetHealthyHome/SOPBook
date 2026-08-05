/**
 * Preset accounts configured through environment variables.
 *
 * These exist so the app is usable before anyone has been added to the
 * `app_users` table. An account whose password variable is unset is disabled
 * entirely — it can never be logged into.
 *
 * They are deliberately shared by the login route and the live-session check:
 * a session for one of these names has no database row behind it, so the
 * revocation check must recognise it rather than treating it as a deleted
 * user.
 */
export interface FallbackAccount {
  name: string;
  role: string;
  userType: 'admin' | 'user';
  password: string;
}

// The environment variable is named rather than read here, so the lookup
// happens per call. Reading process.env at module load would freeze the set
// of enabled accounts at first import, meaning an account could not be
// disabled without a redeploy.
const DEFINITIONS: [string, string, 'admin' | 'user', string][] = [
  ['Marcus Thorne', 'HVAC Supervisor',     'admin', 'PW_MARCUS'],
  ['Sarah Lin',     'Master Electrician',  'admin', 'PW_SARAH'],
  ['Alex Rivers',   'Field Apprentice',    'user',  'PW_ALEX'],
  ['Derrick Vance', 'Plumbing Specialist', 'user',  'PW_DERRICK'],
];

/** Enabled preset accounts, keyed by lowercased name. */
export function fallbackAccounts(): Record<string, FallbackAccount> {
  const map: Record<string, FallbackAccount> = {};
  for (const [name, role, userType, envVar] of DEFINITIONS) {
    const password = process.env[envVar];
    if (!password) continue; // no password configured — account disabled
    map[name.toLowerCase()] = { name, role, userType, password };
  }
  return map;
}

export function fallbackAccount(name: string): FallbackAccount | undefined {
  return fallbackAccounts()[name.trim().toLowerCase()];
}
