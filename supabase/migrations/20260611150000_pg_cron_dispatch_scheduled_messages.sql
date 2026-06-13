-- ============================================================================
-- pg_cron-driven dispatch for scheduled follow-up messages
-- ============================================================================
-- WHY: Vercel Cron on the Hobby plan only runs once/day and is best-effort, so
-- the `*/30` dispatch schedule in vercel.json was being ignored — delayed
-- follow-ups never auto-fired (had to be sent manually). This moves the
-- *scheduling* into the database via pg_cron + pg_net, which fires reliably
-- every minute independent of the hosting plan. The dispatch *logic* stays in
-- the Next.js endpoint (/api/cron/dispatch-scheduled-messages); pg_cron just
-- pings it with the CRON_SECRET bearer, exactly like Vercel Cron did.
--
-- SCALE: the endpoint's runDueScheduledMessages() already claims rows
-- atomically (WHERE status='scheduled' mutex) and batches 100 rows/sweep, so a
-- 1-minute cadence is safe under concurrency and keeps follow-up timing tight.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any prior incarnation of this job before recreating it so
-- re-running the migration doesn't stack duplicate schedules.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'dispatch-scheduled-messages') then
    perform cron.unschedule('dispatch-scheduled-messages');
  end if;
end $$;

-- Every minute: POST to the dispatch endpoint with the CRON_SECRET bearer.
-- The endpoint authenticates on `Authorization: Bearer <CRON_SECRET>` and runs
-- the same sweep Vercel Cron used to trigger.
--
-- ⚠️ SUPERSEDED + NEUTRALIZED (Gerald audit C-01, 2026-06-13).
-- This migration originally embedded a live CRON_SECRET literal and the dev
-- Vercel URL. That secret has been ROTATED and is dead. The real, hardened
-- job (Vault-backed secret, prod-targeted) is created by:
--   20260613100000_pg_cron_dispatch_vault_prod.sql
-- The block below is intentionally a NO-OP so a fresh `supabase db reset` /
-- replay cannot re-leak the old token or re-point cron at dev. Do not restore
-- the literal. The superseding migration runs after this and installs the
-- correct job.
do $$ begin
  raise notice 'pg_cron dispatch job intentionally skipped here; see 20260613100000_pg_cron_dispatch_vault_prod.sql';
end $$;
