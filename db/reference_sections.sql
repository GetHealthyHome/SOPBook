-- Structured reference sections for SOPs and training modules:
-- PPE, required hardware/machinery, consumables & maintenance supplies,
-- and technical terms/acronyms. All free text (with rich-text markers).
--
-- Run once in the Supabase SQL editor (safe to re-run).

-- SOPs -----------------------------------------------------------------
alter table sops add column if not exists ppe          text not null default '';
alter table sops add column if not exists hardware     text not null default '';
alter table sops add column if not exists consumables  text not null default '';
alter table sops add column if not exists terms        text not null default '';

-- Carry existing tools -> hardware and materials -> consumables so no
-- content is lost. tools/materials are jsonb; only migrate rows whose
-- value is a non-empty jsonb string (the app stored them as strings).
update sops
set hardware = trim(both '"' from tools::text)
where hardware = '' and jsonb_typeof(tools) = 'string' and tools::text <> '""';

update sops
set consumables = trim(both '"' from materials::text)
where consumables = '' and jsonb_typeof(materials) = 'string' and materials::text <> '""';

-- Training modules -----------------------------------------------------
alter table training_modules add column if not exists ppe          text not null default '';
alter table training_modules add column if not exists hardware     text not null default '';
alter table training_modules add column if not exists consumables  text not null default '';
alter table training_modules add column if not exists terms        text not null default '';
