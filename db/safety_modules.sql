-- Safety modules: authored OSHA-style safety overviews and toolbox talks.
-- Each module is a title, a rich-text body (markdown-style markers, stored as
-- plain text), an optional photo, and an optional reference link.
--
-- Run once in the Supabase SQL editor (safe to re-run).

create table if not exists safety_modules (
  id           bigint generated always as identity primary key,
  title        text        not null,
  body         text        not null default '',
  image_url    text        not null default '',
  link_url     text        not null default '',
  link_label   text        not null default '',
  order_index  integer     not null default 0,
  created_by   text        not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists safety_modules_order_idx on safety_modules (order_index, created_at);

-- All access goes through the API routes using the service key, which bypasses
-- RLS. Enabling it keeps the table closed to anon/authenticated clients.
alter table safety_modules enable row level security;
