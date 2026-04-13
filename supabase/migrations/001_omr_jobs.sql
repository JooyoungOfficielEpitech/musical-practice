-- M3: OMR job queue
-- Table stores one row per PDF import job; server polls for pending rows.

create table if not exists omr_jobs (
  id                  uuid primary key default gen_random_uuid(),
  status              text not null default 'pending'
                      check (status in ('pending', 'processing', 'done', 'failed')),
  pdf_storage_path    text not null,
  page_ranges         jsonb not null default '[]',
  result_storage_path text,
  error               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Auto-update updated_at on every row change
create or replace function omr_jobs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger omr_jobs_updated_at
  before update on omr_jobs
  for each row execute procedure omr_jobs_set_updated_at();

-- RLS: anonymous / dev mode — all rows publicly readable and writable.
-- Tighten to auth.uid() in M4 when user accounts are required.
alter table omr_jobs enable row level security;

create policy "omr_jobs_public_all"
  on omr_jobs for all
  using (true)
  with check (true);

-- Storage buckets are created via Supabase dashboard or CLI:
--   supabase storage create omr-pdfs   (public upload, authenticated read)
--   supabase storage create omr-results (service-role upload, public read)
