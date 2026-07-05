-- Career ladder upgrade: sub-tasks + admin sign-off verification
--
-- Run this once in the Supabase SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Both statements are additive and safe to re-run.

-- Sub-tasks: a task may have a parent task in the same track
alter table career_tasks
  add column if not exists parent_task_id bigint references career_tasks(id) on delete cascade;

create index if not exists career_tasks_parent_idx on career_tasks(parent_task_id);

-- Admin sign-off: a completion is "pending" until an admin verifies it
alter table career_completions
  add column if not exists verified_by text,
  add column if not exists verified_at timestamptz;
