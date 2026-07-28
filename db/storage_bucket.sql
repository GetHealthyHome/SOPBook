-- Storage bucket for SOP/training step and cover photos.
-- /api/upload writes here with the service key and serves files via the
-- bucket's public URL, so the bucket must exist and be public.
--
-- Run once in the Supabase SQL editor (safe to re-run).
-- Uploads fail with "Failed to upload image." when this bucket is missing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sop-images', 'sop-images', true,
  10485760, -- 10 MB, matching the /api/upload formidable limit
  array['image/jpeg','image/png','image/webp','image/gif','image/heic']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic'];
