-- Field incident reports: injuries and illnesses, damage to a customer's home,
-- near misses, and vehicle or equipment events.
--
-- Anyone on the crew can file one — that is the point, since the person who
-- saw it is the person holding the phone. Reading is restricted in the API to
-- the person who filed it plus admins, because these carry injury details and
-- named individuals.
--
-- Editing is restricted too: the filer may correct their own report only while
-- it is still `submitted`. Once an admin starts reviewing, the account of what
-- happened is frozen and only admins can add to it. That matters if a report
-- is ever produced in an insurance claim or an OSHA inquiry.
--
-- RLS is enabled with no policies, matching every other table here: all access
-- goes through the API using the service role key, which bypasses RLS.
--
-- Run once in the Supabase SQL editor (safe to re-run).

create table if not exists incident_reports (
  id                bigint generated always as identity primary key,

  -- What happened
  category          text        not null default 'other',   -- injury | property | near_miss | vehicle | other
  severity          text        not null default 'minor',   -- minor | moderate | major
  osha_recordable   boolean     not null default false,
  occurred_at       timestamptz not null default now(),
  location          text        not null default '',        -- customer address or job site
  job_reference     text        not null default '',        -- job / work order number

  -- The account of the incident
  description       text        not null default '',        -- rich-text markers, rendered as React elements
  immediate_actions text        not null default '',
  people_involved   text        not null default '',
  witnesses         text        not null default '',
  photo_urls        jsonb       not null default '[]'::jsonb,

  -- Customer-facing facts
  customer_notified boolean     not null default false,
  estimated_cost    integer,                                -- whole dollars, nullable

  -- Review workflow: submitted -> reviewing -> closed
  status            text        not null default 'submitted',
  review_notes      text        not null default '',        -- admin only, never returned to non-admins
  corrective_action text        not null default '',        -- admin only to write; filer may read it
  reviewed_by       text        not null default '',
  reviewed_at       timestamptz,
  closed_at         timestamptz,

  -- Provenance: always taken from the verified session, never the request body
  reported_by       text        not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists incident_reports_recent_idx
  on incident_reports (occurred_at desc, created_at desc);
create index if not exists incident_reports_reporter_idx
  on incident_reports (reported_by);
create index if not exists incident_reports_status_idx
  on incident_reports (status);

alter table incident_reports enable row level security;

-- Filing an incident notifies admins through user_notifications. If that table
-- has a CHECK constraint on `type`, 'incident' needs adding to it — the report
-- itself still saves either way, the notification is best-effort:
--
--   alter table user_notifications drop constraint if exists user_notifications_type_check;
--   alter table user_notifications add constraint user_notifications_type_check
--     check (type in ('sop', 'handbook', 'incident'));
