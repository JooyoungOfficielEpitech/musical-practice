-- M3.1: Add real-time progress tracking to omr_jobs
-- Apply via: supabase db push  OR  Supabase dashboard → SQL editor

-- Add progress_percent column (0–100, updated by OMR server after each page)
ALTER TABLE omr_jobs
  ADD COLUMN IF NOT EXISTS progress_percent smallint NOT NULL DEFAULT 0
    CONSTRAINT omr_jobs_progress_range CHECK (progress_percent BETWEEN 0 AND 100);

-- Enable Supabase Realtime for this table so clients receive row-change events.
-- Guard against "already a member" error if the table was added manually via dashboard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'omr_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE omr_jobs;
  END IF;
END;
$$;
