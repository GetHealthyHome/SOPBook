-- BREAK-GLASS PASSWORD RESET
-- =========================================================================
-- Use this only when no admin can log in to reset a password from inside
-- the app (e.g. the sole admin forgot their password). It resets any
-- account's password directly in the database, using only Supabase access.
--
-- HOW TO RUN:
--   Supabase dashboard -> SQL Editor -> New query -> paste -> edit the two
--   values below -> Run. Then log in with the new password. The app will
--   transparently upgrade the stored hash to scrypt on that first login.
--
-- The value written here is a salted SHA-256 hash (the app's legacy format),
-- which the login endpoint still accepts. The plaintext is never stored.
-- =========================================================================

update app_users
set password_hash = encode(
  digest('sop_auth_salt_2026_v1' || 'CHANGE_ME_NEW_PASSWORD', 'sha256'),
  'hex'
)
where name = 'EXACT ACCOUNT NAME';   -- e.g. 'Marcus Thorne' (case-sensitive)

-- Verify it hit exactly one row:
-- select name, role, user_type from app_users where name = 'EXACT ACCOUNT NAME';

-- ---- NOTES -------------------------------------------------------------
-- • `digest()` comes from the pgcrypto extension, which Supabase enables by
--   default. If you get "function digest does not exist", run once:
--       create extension if not exists pgcrypto with schema extensions;
--   and then prefix the call as extensions.digest(...).
--
-- • For a PRESET account (Marcus Thorne / Sarah Lin / Alex Rivers /
--   Derrick Vance) that has NO row in app_users, there is an even simpler
--   recovery: those accounts fall back to the Vercel environment variables
--   PW_MARCUS / PW_SARAH / PW_ALEX / PW_DERRICK. Set that variable in
--   Vercel to a known value and redeploy — no SQL needed. (If a row for
--   that name DOES exist in app_users, it overrides the env var, so delete
--   the row or use the UPDATE above.)
