-- Per-division cover photos for the SOP dashboard tiles.
-- One row per division; the division name is the key.
--
-- Run once in the Supabase SQL editor (safe to re-run).

create table if not exists division_photos (
  division    text primary key,
  image_url   text        not null default '',
  updated_by  text        not null default '',
  updated_at  timestamptz not null default now()
);

-- Reads go through the API for any signed-in teammate; writes are admin-only.
-- Both use the service key, which bypasses RLS.
alter table division_photos enable row level security;
