-- 20261117130000_admin_last_active.sql
-- Admin Users panel "Last active" fix (owner 2026-11-17, Aldridge/Clarity case).
--
-- PROBLEM: the panel read auth.users.last_sign_in_at, which Supabase only
-- updates when a user completes a NEW sign-in (magic link / OAuth / password).
-- Returning users with a still-valid session silently refresh tokens and
-- NEVER touch last_sign_in_at - so active users showed weeks-old dates while
-- Clarity recorded them browsing the app.
--
-- FIX: expose real activity = max(auth.sessions.updated_at) (bumped on every
-- token refresh while the user browses) via a SECURITY DEFINER RPC callable
-- by the service-role client. Falls back to last_sign_in_at / created_at for
-- users with no session rows.

create or replace function public.admin_user_last_active(p_user_ids uuid[])
returns table (
  user_id uuid,
  last_sign_in_at timestamptz,
  last_active_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.id as user_id,
    u.last_sign_in_at,
    greatest(
      coalesce(u.last_sign_in_at, u.created_at),
      coalesce(ps.sess_max, u.created_at)
    ) as last_active_at
  from auth.users u
  left join lateral (
    select max(s.updated_at) as sess_max
    from auth.sessions s
    where s.user_id = u.id
  ) ps on true
  where u.id = any(p_user_ids)
$$;

revoke all on function public.admin_user_last_active(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_user_last_active(uuid[]) to service_role;
