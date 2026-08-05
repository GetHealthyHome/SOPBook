-- Security lockdown: close direct database access that bypassed the API.
--
-- BACKGROUND
-- Six tables carried permissive `USING (true)` RLS policies left over from the
-- original prototype. They were granted to the PUBLIC role, which in Postgres
-- includes `anon` and `authenticated` — that is, anyone holding the project's
-- publishable anon key, which is designed to be distributable and is visible
-- in the Supabase dashboard. Through PostgREST those policies allowed:
--
--   documents           SELECT, INSERT, UPDATE   (every SOP, readable and writable)
--   career_assignments  SELECT, INSERT, UPDATE, DELETE
--   career_completions  SELECT, INSERT, DELETE   (training records, deletable)
--   career_tasks        SELECT
--   career_tracks       SELECT
--   handbook_sections   SELECT
--
-- None of this was reachable through the app, which sends every query with the
-- service role key — and the service role bypasses RLS entirely. Dropping the
-- policies therefore changes nothing for the application while removing the
-- parallel, unauthenticated path into the data.
--
-- Run once in the Supabase SQL editor (safe to re-run).

drop policy if exists "Allow public read access" on public.documents;
drop policy if exists "Allow public inserts"     on public.documents;
drop policy if exists "Allow public updates"     on public.documents;

drop policy if exists "Public read assignments"  on public.career_assignments;
drop policy if exists "Insert assignments"       on public.career_assignments;
drop policy if exists "Update assignments"       on public.career_assignments;
drop policy if exists "Delete assignments"       on public.career_assignments;

drop policy if exists "Public read completions"  on public.career_completions;
drop policy if exists "Insert completions"       on public.career_completions;
drop policy if exists "Delete completions"       on public.career_completions;

drop policy if exists "Public read tasks"        on public.career_tasks;
drop policy if exists "Public read tracks"       on public.career_tracks;
drop policy if exists "Public read"              on public.handbook_sections;

-- Defence in depth: take away the underlying table grants too, so a policy
-- added by mistake later cannot re-open these tables on its own.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Event-trigger helper. It only does anything when fired by the DDL event
-- trigger, but it should not sit on the public RPC surface.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Verification: both of these should return 0.
--   select count(*) from pg_policies where schemaname = 'public';
--   select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
--     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
