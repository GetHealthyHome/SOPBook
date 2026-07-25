-- Training completion validation: a team member marks a training module
-- complete; an admin validates (signs off) that completion — mirroring
-- the career ladder's milestone verification.
--
-- Run once in the Supabase SQL editor (safe to re-run).

create table if not exists training_completions (
  id bigint generated always as identity primary key,
  module_id bigint not null references training_modules(id) on delete cascade,
  user_name text not null,
  user_role text not null default '',
  completed_at timestamptz not null default now(),
  verified_by text,
  verified_at timestamptz,
  unique (module_id, user_name)
);

alter table training_completions enable row level security;

create index if not exists training_completions_module_idx on training_completions(module_id);
create index if not exists training_completions_user_idx on training_completions(user_name);
