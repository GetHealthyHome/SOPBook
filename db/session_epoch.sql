-- Session revocation support.
--
-- Session cookies are self-contained HMAC-signed tokens valid for 8 hours.
-- That means a password reset, a demotion from admin to user, or an account
-- deletion previously left the old cookie fully usable until it expired —
-- someone removed from the team kept working access, and a demoted admin kept
-- admin power, for up to eight hours.
--
-- This counter is stamped into the token at login and compared on every
-- privileged request. Bumping it invalidates every session issued beforehand.
-- The API sets it to the current unix second on any password change, which is
-- monotonic and avoids a read-modify-write race.
--
-- Deletions and demotions need no bump: the live check reads `user_type`
-- straight from this table on each privileged request, and a missing row ends
-- the session outright.
--
-- Run once in the Supabase SQL editor (safe to re-run).

alter table public.app_users
  add column if not exists session_epoch integer not null default 0;
