-- 004: Let authenticated users read LEGACY root-level omr-results objects.
--
-- Results written before user-scoping live at the bucket root
-- ("{job_id}.musicxml" / "{job_id}.preview.jpg") with no {user_id}/ prefix,
-- so the path-scoped omr_results_select policy denies them and old sheets
-- can never refresh their result or fetch a preview thumbnail.
--
-- These objects predate multi-user concerns (single-device era) and contain
-- only sheet-music renders — reading them from any authenticated (anonymous)
-- session of this app is acceptable. New results are always user-prefixed.

create policy "omr_results_select_legacy_root"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'omr-results'
    AND position('/' in name) = 0
  );
