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
-- NOTE ON PROMOTION TO PROD: when this job should target the production
-- deployment, update the URL below (and the bearer if the prod CRON_SECRET
-- differs) by re-running an updated version of this migration. Kept inline
-- (not in Vault) deliberately for now so the scheduler is fully self-contained
-- and obvious; revisit Vault-backed secrets if/when we run multiple targets.
select cron.schedule(
  'dispatch-scheduled-messages',
  '* * * * *',
  $cron$
  -- GET to match the route's `export async function GET` handler.
  select net.http_get(
    url     := 'https://quotecore-plus-dev.vercel.app/api/cron/dispatch-scheduled-messages',
    headers := jsonb_build_object(
      'Authorization', 'Bearer A7EQEOYpMe4fg8wLQY-DwjaRk2mZg1XFlwWzCNX79Vs'
    ),
    timeout_milliseconds := 25000
  );
  $cron$
);
