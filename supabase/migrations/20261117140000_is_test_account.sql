-- 20261117140000_is_test_account.sql
-- App users vs Test users split (owner 2026-11-17 09:27 + 09:34 "go ahead,
-- my only test account is rs roofing").
--
-- Companies (tenants) carry an is_test_account flag so the admin Users panel
-- can show "App users" (real signups: paying, free, or lapsed) separately
-- from internal test/QA/harness accounts. Default false = App user, so every
-- future signup lands in the real list automatically.
--
-- One-time seed: classify the known test corpus by email domain/pattern plus
-- the owner's RS Roofing test accounts. Demo-plan companies stay unflagged -
-- they are already excluded from the Users panel by plan_code='demo'.

alter table public.companies
  add column if not exists is_test_account boolean not null default false;

update public.companies c
set is_test_account = true
where exists (
  select 1 from public.users u
  where u.company_id = c.id
    and (
      u.email ilike any (array[
        '%@quotecore.test',
        '%@quotecore.invalid',
        '%@quote-core.invalid',
        '%@demo.invalid',
        '%@example.com',
        '%@t3play.com',
        '%@quotecoreapp.com'
      ])
      or u.email ilike 'gavin.probe+%'
    )
)
or c.name = 'RS Roofing';
