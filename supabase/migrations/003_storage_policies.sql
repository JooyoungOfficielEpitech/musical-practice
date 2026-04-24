-- M3.2: Storage RLS policies for omr-pdfs and omr-results buckets
-- Apply via: supabase db push  OR  Supabase dashboard → SQL editor
--
-- Bucket creation (one-time, idempotent via dashboard or supabase CLI):
--   supabase storage create omr-pdfs --public false
--   supabase storage create omr-results --public false
--
-- Path convention enforced by these policies:
--   omr-pdfs:    {user_id}/{job_id}.pdf
--   omr-results: {user_id}/{job_id}.musicxml  (written by service-role worker)

-- ── omr-pdfs: authenticated users upload/manage their own files ──────────────

create policy "omr_pdfs_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'omr-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "omr_pdfs_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'omr-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "omr_pdfs_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'omr-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── omr-results: authenticated users read their own results ──────────────────
-- (Service-role worker writes results — no INSERT policy needed for anon/auth)

create policy "omr_results_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'omr-results'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── omr_jobs table: scope rows to the owning user ────────────────────────────
-- Add user_id column if not already present (safe to re-run)
ALTER TABLE omr_jobs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the old dev-only open policy and replace with user-scoped policies
DROP POLICY IF EXISTS "omr_jobs_public_all" ON omr_jobs;

CREATE POLICY "omr_jobs_insert"
  ON omr_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "omr_jobs_select"
  ON omr_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service-role worker needs UPDATE access (no RLS for service_role by default,
-- so this policy is just documentation — service_role bypasses RLS)
CREATE POLICY "omr_jobs_update_owner"
  ON omr_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
