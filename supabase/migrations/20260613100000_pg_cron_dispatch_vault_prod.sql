-- ============================================================================
-- Harden + repoint pg_cron dispatch job (supersedes 20260611150000)
-- ============================================================================
-- WHY (Gerald audit C-01, 2026-06-12):
--   The prior migration (20260611150000) embedded a live CRON_SECRET bearer as
--   a SQL literal AND hard-coded the *dev* Vercel URL. That is a secret-leak
--   (token now in git history) and a go-live trap (prod would keep dispatching
--   through the dev deployment).
--
-- FIX:
--   1. The leaked secret has been ROTATED out-of-band (new CRON_SECRET set in
--      Vercel env for all environments; old token is dead once main redeploys).
--   2. The new secret lives in Supabase Vault as `cron_dispatch_secret` — it is
--      NEVER written as a literal in migration SQL or cron.job metadata. The job
--      reads it at runtime via vault.decrypted_secrets.
--   3. The standing job targets PRODUCTION (app.quote-core.com). "Cron only runs
--      against main/prod" — dev follow-up testing is done on-demand by manually
--      hitting the dev endpoint with the secret (see scripts/trigger-dev-dispatch.ps1).
--
-- IDEMPOTENT: safe to re-run. Drops any prior incarnation first.
--
-- PREREQUISITE (one-time, done out-of-band via Management API — documented here
-- for reproducibility; NOT executed in this migration so the secret value never
-- appears in SQL):
--   select vault.create_secret('<ROTATED_SECRET>', 'cron_dispatch_secret',
--          'Bearer secret for scheduled-message dispatch cron');
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- Drop any prior incarnation (dev-targeted, literal-secret version included).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'dispatch-scheduled-messages') then
    perform cron.unschedule('dispatch-scheduled-messages');
  end if;
end $$;

-- Every minute: GET the PRODUCTION dispatch endpoint with the Vault-stored
-- bearer. No literal secret; no dev URL. The endpoint authenticates on
-- `Authorization: Bearer <CRON_SECRET>` and runs the dispatch sweep.
select cron.schedule(
  'dispatch-scheduled-messages',
  '* * * * *',
  $cron$
  select net.http_get(
    url     := 'https://app.quote-core.com/api/cron/dispatch-scheduled-messages',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_dispatch_secret')
    ),
    timeout_milliseconds := 25000
  );
  $cron$
);

-- Smoke check (Gerald C-01 remediation #4): confirm the live job targets prod
-- and carries no literal secret. Raises if the invariant is violated.
do $$
declare
  v_cmd text;
begin
  select command into v_cmd from cron.job where jobname = 'dispatch-scheduled-messages';
  if v_cmd is null then
    raise exception 'dispatch-scheduled-messages cron job missing after schedule';
  end if;
  if position('app.quote-core.com' in v_cmd) = 0 then
    raise exception 'cron job does not target production (app.quote-core.com)';
  end if;
  if v_cmd ~ 'Bearer [A-Za-z0-9_-]{20,}' then
    raise exception 'cron job appears to contain a literal bearer secret';
  end if;
  if position('decrypted_secrets' in v_cmd) = 0 then
    raise exception 'cron job does not read secret from Vault';
  end if;
end $$;
