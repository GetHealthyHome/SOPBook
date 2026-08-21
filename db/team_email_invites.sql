-- Email addresses, divisions, and the invitation flow.
--
-- Adding a team member used to mean an admin typing a password and passing it
-- along by hand. That admin then knew someone else's password, and there was
-- no way to be sure it ever got changed. Now the member gets a single-use link
-- and chooses their own.
--
-- `division` is separate from `role` on purpose. `role` is a job title
-- ("Install Tech", "Operations Manager"); `division` is one of the five names
-- SOPs are tagged with, which is what lets a reminder about an HVAC procedure
-- be aimed at the HVAC crew.
--
-- RLS is enabled with no policies on the new tables, matching every other
-- table here: all access goes through the API using the service role key,
-- which bypasses RLS.
--
-- Run once in the Supabase SQL editor (safe to re-run).

alter table app_users add column if not exists email    text;
alter table app_users add column if not exists division text;

-- An invited member has no password until they set one, so the column can no
-- longer be NOT NULL. Login treats a null hash as "cannot sign in yet" and
-- says so, rather than reporting bad credentials to someone who typed
-- nothing wrong.
alter table app_users alter column password_hash drop not null;

-- Case-insensitive uniqueness: two people cannot share an inbox. Partial, so
-- the column stays nullable while existing members are filled in.
create unique index if not exists app_users_email_lower_key
  on app_users (lower(email)) where email is not null;

-- Invitations.
--
-- Only the SHA-256 of a token is stored, so a leaked database yields no usable
-- link. Issuing a new invite retires any earlier unused one, which is what
-- makes a resend invalidate a link that went to the wrong address.
create table if not exists user_invites (
  id          bigint generated always as identity primary key,
  user_name   text        not null,
  email       text        not null,
  token_hash  text        not null unique,
  purpose     text        not null default 'invite' check (purpose in ('invite', 'reset')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  text        not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists user_invites_user_idx    on user_invites (user_name);
create index if not exists user_invites_expires_idx on user_invites (expires_at);

alter table user_invites enable row level security;

-- What was sent, to whom, and whether it landed.
--
-- Two jobs: it shows an admin that a reminder already went out on Tuesday, so
-- nobody gets chased four times; and it makes a silent SMTP failure visible in
-- the console instead of only in the server logs.
create table if not exists email_log (
  id         bigint generated always as identity primary key,
  to_email   text        not null,
  user_name  text        not null default '',
  kind       text        not null,
  subject    text        not null default '',
  status     text        not null,
  detail     text        not null default '',
  sent_by    text        not null default '',
  created_at timestamptz not null default now()
);

create index if not exists email_log_user_idx    on email_log (user_name, created_at desc);
create index if not exists email_log_created_idx on email_log (created_at desc);

alter table email_log enable row level security;
