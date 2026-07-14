-- Unified auth: helper to detect whether an auth user has a password set.
-- Used by the /onboarding set-password gate: users who signed up via free
-- tools with a magic link (passwordless) or OAuth have no password; when
-- they enter the app for the first time we prompt them to create one.
--
-- SECURITY DEFINER because auth.users is not readable via PostgREST.
-- Execution restricted to service_role only (called from server with the
-- admin client) — never exposed to anon/authenticated.

create or replace function public.auth_user_has_password(uid uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    (select encrypted_password is not null and encrypted_password <> ''
     from auth.users where id = uid),
    false
  );
$$;

revoke execute on function public.auth_user_has_password(uuid) from public;
revoke execute on function public.auth_user_has_password(uuid) from anon;
revoke execute on function public.auth_user_has_password(uuid) from authenticated;
grant execute on function public.auth_user_has_password(uuid) to service_role;
