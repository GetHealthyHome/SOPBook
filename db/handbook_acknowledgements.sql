-- Handbook acknowledgements: an immutable record that a team member has
-- read and acknowledged a handbook section at its current content.
--
-- A content hash is stored so that when a section is later edited, prior
-- acknowledgements no longer match the current content — surfacing who
-- still needs to re-acknowledge.
--
-- Run once in the Supabase SQL editor (safe to re-run).

create table if not exists handbook_acknowledgements (
  id bigint generated always as identity primary key,
  section_id uuid not null references handbook_sections(id) on delete cascade,
  user_name text not null,
  user_role text not null default '',
  content_hash text not null,
  acknowledged_at timestamptz not null default now(),
  unique (section_id, user_name)
);

alter table handbook_acknowledgements enable row level security;

create index if not exists handbook_ack_section_idx on handbook_acknowledgements(section_id);
create index if not exists handbook_ack_user_idx on handbook_acknowledgements(user_name);
