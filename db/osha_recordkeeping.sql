-- OSHA injury and illness recordkeeping (29 CFR Part 1904).
--
-- Extends incident_reports with the fields OSHA Forms 300, 300A and 301
-- require but a field report does not naturally capture: employee identifiers,
-- treating physician, case classification and lost-day counts.
--
-- The field report stays as it is. These columns are filled in by an admin
-- during review, because recordability is a determination, not something the
-- person who got hurt should have to decide on a driveway.
--
-- WHO THIS APPLIES TO
--   Construction (NAICS 23) is not partially exempt by industry. The exemption
--   that may apply is size: an establishment with 10 or fewer employees at all
--   times during the previous calendar year is partially exempt from keeping
--   the 300, 300A and 301 (1904.1). Fatality and severe-injury reporting under
--   1904.39 still applies to everyone, exempt or not.
--
-- Run once in the Supabase SQL editor (safe to re-run).
-- Requires db/incident_reports.sql to have been run first.

alter table incident_reports
  -- Case identity -----------------------------------------------------------
  add column if not exists osha_case_number    text,          -- sequential per calendar year, e.g. 2026-001
  add column if not exists osha_privacy_case   boolean not null default false,
  add column if not exists osha_determined_by  text    not null default '',
  add column if not exists osha_determined_at  timestamptz,

  -- Form 301 fields 1-5: information about the employee ---------------------
  add column if not exists employee_name       text    not null default '',
  add column if not exists employee_job_title  text    not null default '',
  add column if not exists employee_address    text    not null default '',
  add column if not exists employee_dob        date,
  add column if not exists employee_hire_date  date,
  add column if not exists employee_sex        text    not null default '',   -- male | female | ''

  -- Form 301 fields 6-9: physician / health care ----------------------------
  add column if not exists physician_name      text    not null default '',
  add column if not exists treatment_facility  text    not null default '',
  add column if not exists treated_in_er       boolean not null default false,
  add column if not exists hospitalized        boolean not null default false,

  -- Form 301 fields 12-18: the case -----------------------------------------
  add column if not exists time_began_work     text    not null default '',   -- HH:MM
  add column if not exists time_of_event       text    not null default '',   -- HH:MM, blank if not determined
  add column if not exists activity_before     text    not null default '',   -- field 14
  add column if not exists injury_description  text    not null default '',   -- field 16: nature + body part
  add column if not exists harm_source         text    not null default '',   -- field 17: object or substance
  add column if not exists date_of_death       date,                          -- field 18

  -- Form 300 columns G-M: classification and days ---------------------------
  -- outcome: death | days_away | restricted | other   (columns G, H, I, J)
  add column if not exists case_outcome        text    not null default '',
  add column if not exists days_away           integer not null default 0,    -- column K
  add column if not exists days_restricted     integer not null default 0,    -- column L
  -- illness_type: injury | skin | respiratory | poisoning | hearing | other  (column M)
  add column if not exists illness_type        text    not null default 'injury';

-- Case numbers are unique within the log.
create unique index if not exists incident_reports_case_number_idx
  on incident_reports (osha_case_number)
  where osha_case_number is not null;

-- The 300 log and 300A summary are both "recordable cases in a calendar year".
create index if not exists incident_reports_recordable_idx
  on incident_reports (osha_recordable, occurred_at);

-- Establishment details for the form headers and the 300A certification.
-- Written through /api/admin/settings, which allowlists these keys.
insert into app_settings (key, value)
values
  ('osha_establishment_name', ''),
  ('osha_establishment_street', ''),
  ('osha_establishment_city', ''),
  ('osha_establishment_state', ''),
  ('osha_establishment_zip', ''),
  ('osha_industry_description', ''),
  ('osha_naics', ''),
  ('osha_annual_avg_employees', ''),
  ('osha_total_hours_worked', ''),
  ('osha_executive_name', ''),
  ('osha_executive_title', ''),
  ('osha_executive_phone', '')
on conflict (key) do nothing;
