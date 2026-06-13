-- ============================================================================
-- Atomic claim for scheduled-message dispatch (Gerald audit H-01)
-- ============================================================================
-- WHY: runDueScheduledMessages() selected due rows (status='scheduled',
-- fire_at<=now) and only flipped status AFTER sending. With pg_cron firing
-- every minute PLUS inline event activators, two overlapping sweeps could both
-- read the same due row and both send before either marked it sent -> duplicate
-- payment chasers / quote follow-ups to customers.
--
-- FIX: a SECURITY DEFINER RPC that atomically claims due rows using
-- FOR UPDATE SKIP LOCKED, flipping 'scheduled' -> 'dispatching' and returning
-- the claimed rows. Only the worker that wins the claim ever sees the row, so
-- the subsequent send + terminal flip ('dispatching' -> sent/cancelled/failed)
-- is race-free. SKIP LOCKED means concurrent sweeps grab disjoint row sets
-- instead of colliding.
--
-- CRASH RECOVERY: if a worker dies mid-send, the row is stranded in
-- 'dispatching'. reclaim_stale_dispatching_messages() returns rows that have
-- been 'dispatching' longer than the stale window back to 'scheduled' so a
-- later sweep retries them. The claim RPC calls this first each sweep.
-- Default stale window: 10 minutes (>> the 25s http timeout + send latency).
-- ============================================================================

-- 1. Allow the new transient status.
alter table public.scheduled_messages
  drop constraint if exists scheduled_messages_status_check;

alter table public.scheduled_messages
  add constraint scheduled_messages_status_check
  check (status = any (array[
    'scheduled'::text,
    'dispatching'::text,
    'sent'::text,
    'cancelled'::text,
    'suppressed'::text,
    'failed'::text
  ]));

-- 2. Track when a row was claimed (for stale-reclaim + observability).
alter table public.scheduled_messages
  add column if not exists claimed_at timestamptz;

-- Partial index to make the due-row scan + stale-reclaim cheap.
create index if not exists idx_scheduled_messages_due_scheduled
  on public.scheduled_messages (fire_at)
  where status = 'scheduled';

create index if not exists idx_scheduled_messages_dispatching
  on public.scheduled_messages (claimed_at)
  where status = 'dispatching';

-- 3. Stale-reclaim: rows stuck in 'dispatching' (crashed worker) revert so a
--    later sweep retries them.
create or replace function public.reclaim_stale_dispatching_messages(
  p_stale_minutes integer default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.scheduled_messages
     set status = 'scheduled',
         claimed_at = null
   where status = 'dispatching'
     and claimed_at is not null
     and claimed_at < now() - make_interval(mins => greatest(p_stale_minutes, 1));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 4. Atomic claim: flip due 'scheduled' rows -> 'dispatching' and return them.
--    FOR UPDATE SKIP LOCKED guarantees disjoint claims across concurrent sweeps.
create or replace function public.claim_due_scheduled_messages(
  p_limit integer default 100,
  p_stale_minutes integer default 10
)
returns setof public.scheduled_messages
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Recover any rows stranded by a crashed previous sweep first.
  perform public.reclaim_stale_dispatching_messages(p_stale_minutes);

  return query
  update public.scheduled_messages sm
     set status = 'dispatching',
         claimed_at = now()
   where sm.id in (
     select id
       from public.scheduled_messages
      where status = 'scheduled'
        and fire_at <= now()
      order by fire_at asc
      for update skip locked
      limit greatest(p_limit, 1)
   )
  returning sm.*;
end;
$$;

-- 5. Lock down: dispatch runs with the service role only.
revoke all on function public.reclaim_stale_dispatching_messages(integer) from public, anon, authenticated;
revoke all on function public.claim_due_scheduled_messages(integer, integer) from public, anon, authenticated;
grant execute on function public.reclaim_stale_dispatching_messages(integer) to service_role;
grant execute on function public.claim_due_scheduled_messages(integer, integer) to service_role;
