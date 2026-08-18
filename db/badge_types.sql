-- Badge types, moved out of hardcoded arrays so admins can add their own.
--
-- The list previously lived in two places that had to be kept in step: a
-- VALID_BADGES allowlist in the API and an ALL_BADGES constant in the client.
-- Adding a certification meant a code change and a deploy, which is the wrong
-- shape for something that changes as the crew picks up new tickets.
--
-- RLS is enabled with no policies, matching every other table here: all access
-- goes through the API using the service role key, which bypasses RLS.
--
-- Run once in the Supabase SQL editor (safe to re-run).

create table if not exists badge_types (
  id          bigint generated always as identity primary key,
  name        text        not null unique,
  colour      text        not null default 'gray',   -- palette key; see BADGE_PALETTE in the client
  order_index integer     not null default 0,
  created_by  text        not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists badge_types_order_idx on badge_types (order_index, name);

alter table badge_types enable row level security;

-- Seed with what used to be hardcoded, plus the two OSHA cards.
insert into badge_types (name, colour, order_index, created_by) values
  ('OSHA 10',      'red',     0, 'system'),
  ('OSHA 30',      'red',     1, 'system'),
  ('EPA 608',      'blue',    2, 'system'),
  ('Spray Foam',   'purple',  3, 'system'),
  ('BPI',          'emerald', 4, 'system'),
  ('Radon',        'amber',   5, 'system'),
  ('Lead',         'orange',  6, 'system'),
  ('Mold Testing', 'teal',    7, 'system'),
  ('Forklift',     'yellow',  8, 'system')
on conflict (name) do nothing;
