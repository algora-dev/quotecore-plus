-- quotecore_v2_patch_053: restore missing UPDATE grant on takeoff_pages
--
-- M7 browser pass (2026-09-21) discovered that `takeoff_pages` has no UPDATE
-- privilege granted to `authenticated` (or `anon`), while SELECT/INSERT/DELETE
-- grants and all four RLS policies exist. Effect: persistPageCalibration (and
-- any other authenticated update of takeoff_pages) fails with
-- "permission denied for table takeoff_pages" — a real, environment-wide
-- release blocker, not touch-specific. The grant was presumably lost when the
-- table was recreated in an earlier migration. This restores the standard
-- Supabase grant set, matching every other app table.

GRANT UPDATE ON PUBLIC.takeoff_pages TO authenticated;
GRANT UPDATE ON PUBLIC.takeoff_pages TO anon;
