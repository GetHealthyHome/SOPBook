-- Training modules: multi-step training content with cover photos,
-- per-step photos, and resource links, in two categories
-- (Home Performance / HVAC).
--
-- Run this once in the Supabase SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Safe to re-run.

create table if not exists training_modules (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null default '',
  category text not null check (category in ('Home Performance', 'HVAC')),
  cover_url text not null default '',
  order_index int not null default 0,
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists training_steps (
  id bigint generated always as identity primary key,
  module_id bigint not null references training_modules(id) on delete cascade,
  title text not null,
  body text not null default '',
  image_urls jsonb not null default '[]',
  link_url text not null default '',
  link_label text not null default '',
  order_index int not null default 0
);

create index if not exists training_steps_module_idx on training_steps(module_id);
