-- 20261120130000_admin_real_counts.sql
-- Admin dashboard real-account counts (owner 2026-11-20 09:14 go).
--
-- PROBLEM: the dashboard "Users"/"Companies" cards count the raw tables with
-- no filters. Every real signup is redirected into the demo once
-- (demo-first onboarding), and each demo session provisions a
-- visitor-xxxx@demo.invalid user + fictional demo company ~30s later - so
-- one real signup bumps the Users card by +2 (owner saw 144 -> 146).
--
-- FIX:
--   1. Backfill: flag companies that currently host a demo visitor user
--      (the 2026-11-17 seed only caught companies existing at that time;
--      demo resets since then created unflagged ones).
--   2. Two SECURITY DEFINER RPCs (service-role only) that count real
--      accounts with the same semantics as the Users panel App view:
--      is_test_account = false AND plan_code <> 'demo'.
--   3. (Code) provision.ts stamps demo companies is_test_account = true at
--      creation from now on.

-- 1. Backfill unflagged demo-visitor companies.
update public.companies c
set is_test_account = true
where not c.is_test_account
  and exists (
    select 1 from public.users u
    where u.company_id = c.id
      and u.email ilike 'visitor-%@demo.invalid'
  );

-- 2. Real-user count (users on non-test, non-demo companies).
create or replace function public.admin_real_user_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from public.users u
  join public.companies c on c.id = u.company_id
  where c.is_test_account = false
    and c.plan_code <> 'demo'
$$;

-- 3. Real-company count (non-test, non-demo companies).
create or replace function public.admin_real_company_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from public.companies c
  where c.is_test_account = false
    and c.plan_code <> 'demo'
$$;

revoke all on function public.admin_real_user_count() from public, anon, authenticated;
revoke all on function public.admin_real_company_count() from public, anon, authenticated;
grant execute on function public.admin_real_user_count() to service_role;
grant execute on function public.admin_real_company_count() to service_role;
