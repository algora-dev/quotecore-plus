-- Free tool AI scan gate (2026-10-02, Darren)
-- Per-identity daily credits + global daily cap with warning support for the
-- anonymous AI scan endpoint (/api/free-tools/ai-scan) on the free roof takeoff.
--
-- Additive only: two new tables, two new RPCs. No changes to existing tables.
-- Service-role only (all grants revoked from anon/authenticated).
--
-- Identity keys are opaque hashes (HMAC of client IP, or HMAC of a plugin
-- client id when one is provided) - no raw PII is stored.
--
-- Day boundaries: current_date (UTC on this project). Counters reset at UTC
-- midnight. The global row's cap refreshes from the caller's env-derived cap
-- on every admission, so changing FREE_AI_SCAN_GLOBAL_DAILY applies instantly
-- without manual DB edits.

create table if not exists public.free_ai_scan_global (
  day date primary key,
  scans integer not null default 0,
  cap_scans integer not null,
  warn_sent boolean not null default false,
  capped_alert_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.free_ai_scan_usage (
  day date not null,
  identity_key text not null,
  scans integer not null default 0,
  primary key (day, identity_key)
);

-- Atomic admission: locks today's global row, checks the global cap and the
-- per-identity cap, then increments both counters in one transaction.
-- Returns: allowed / reason / identity_used / identity_cap / global_used /
-- global_cap / warn (true once the new global count reaches ceil(cap * 0.7)).
create or replace function public.p_free_ai_scan_admission(
  p_identity_key text,
  p_per_identity_cap integer,
  p_global_cap integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := current_date;
  v_global_scans integer;
  v_identity_scans integer;
begin
  -- Ensure today's global row exists; the conflict-update locks it for this
  -- transaction so concurrent admissions serialize correctly.
  insert into public.free_ai_scan_global (day, cap_scans)
  values (v_day, p_global_cap)
  on conflict (day) do update set cap_scans = excluded.cap_scans;

  select scans into v_global_scans
  from public.free_ai_scan_global
  where day = v_day;

  if v_global_scans >= p_global_cap then
    return jsonb_build_object(
      'allowed', false, 'reason', 'global_cap',
      'identity_used', null, 'identity_cap', p_per_identity_cap,
      'global_used', v_global_scans, 'global_cap', p_global_cap,
      'warn', true);
  end if;

  select scans into v_identity_scans
  from public.free_ai_scan_usage
  where day = v_day and identity_key = p_identity_key;

  if coalesce(v_identity_scans, 0) >= p_per_identity_cap then
    return jsonb_build_object(
      'allowed', false, 'reason', 'identity_cap',
      'identity_used', v_identity_scans, 'identity_cap', p_per_identity_cap,
      'global_used', v_global_scans, 'global_cap', p_global_cap,
      'warn', false);
  end if;

  update public.free_ai_scan_global
  set scans = scans + 1
  where day = v_day;

  insert into public.free_ai_scan_usage (day, identity_key, scans)
  values (v_day, p_identity_key, 1)
  on conflict (day, identity_key) do update set scans = public.free_ai_scan_usage.scans + 1;

  return jsonb_build_object(
    'allowed', true, 'reason', null,
    'identity_used', coalesce(v_identity_scans, 0) + 1,
    'identity_cap', p_per_identity_cap,
    'global_used', v_global_scans + 1,
    'global_cap', p_global_cap,
    'warn', (v_global_scans + 1) >= ceil(p_global_cap * 0.7));
end;
$$;

-- Refund: reverse today's admission for one identity after a server-side
-- scan failure. Also frees one global slot so failures never burn budget.
create or replace function public.p_free_ai_scan_refund(
  p_identity_key text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := current_date;
begin
  update public.free_ai_scan_usage
  set scans = scans - 1
  where day = v_day and identity_key = p_identity_key and scans > 0;

  if not found then
    return 0;
  end if;

  update public.free_ai_scan_global
  set scans = greatest(scans - 1, 0)
  where day = v_day and scans > 0;

  return 1;
end;
$$;

-- Lock down: service role only (route handlers use the service client).
revoke all on public.free_ai_scan_global from anon, authenticated;
revoke all on public.free_ai_scan_usage from anon, authenticated;
revoke all on function public.p_free_ai_scan_admission(text, integer, integer) from anon, authenticated;
revoke all on function public.p_free_ai_scan_refund(text) from anon, authenticated;
