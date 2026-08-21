-- Flashcards: a scenario on the front, the answer on the back.
--
-- Built for the way this crew actually learns a new tool or SOP — read the
-- situation, decide what you would do, then turn the card over and check.
-- Short enough to run through while the truck warms up.
--
-- `scenario` and `answer` both carry the same rich-text markers the SOPs use.
-- They are stored as text and rendered as React elements, never injected as
-- HTML.
--
-- RLS is enabled with no policies, matching every other table here: all access
-- goes through the API using the service role key, which bypasses RLS.
--
-- Run once in the Supabase SQL editor (safe to re-run).

create table if not exists flashcards (
  id          bigint generated always as identity primary key,
  scenario    text        not null,
  answer      text        not null default '',
  category    text        not null default '',
  order_index integer     not null default 0,
  created_by  text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists flashcards_order_idx    on flashcards (order_index, created_at);
create index if not exists flashcards_category_idx on flashcards (category);

alter table flashcards enable row level security;
