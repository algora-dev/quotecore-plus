-- 20261120140000_welcome_email_queue.sql
-- Welcome email queue (owner 2026-11-20, copy finalized 09:43).
--
-- The welcome email is sent ~5 minutes after a Free Workspace is first
-- provisioned. provisionFreeWorkspace() in complete-signin.ts is the single
-- choke point BOTH signup paths run through (Google OAuth first sign-in and
-- email/password confirmation click), so the 5-minute timer starts exactly
-- at the moment the owner specced.
--
-- Sending is flag-gated (WELCOME_EMAIL_ENABLED env) and dispatched by the
-- every-minute scheduled-messages cron route (pg_cron primary trigger),
-- which sweeps this queue after its own sweep. Atomic claim via RPC below
-- (FOR UPDATE SKIP LOCKED) so concurrent sweeps can never double-send.

create table if not exists public.welcome_email_queue (
  id uuid primary key default gen_random_uuid(),
  -- One welcome email per auth user, ever (dedupe on re-provisioning).
  user_id uuid not null unique,
  company_id uuid,
  email text not null,
  first_name text,
  fire_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped_test', 'skipped_stale')),
  attempts int not null default 0,
  sent_at timestamptz,
  resend_id text,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.welcome_email_queue enable row level security;

create index if not exists welcome_email_queue_due_idx
  on public.welcome_email_queue (fire_at)
  where status = 'pending';

-- Atomic claim: sweeps mark rows 'sending' (with attempt bump) before any
-- send is attempted, so two overlapping cron invocations can never both
-- pick the same row (same rule as scheduled-messages dispatch).
create or replace function public.claim_due_welcome_emails(p_limit int default 10)
returns setof public.welcome_email_queue
language sql
security definer
set search_path = public
as $$
  update public.welcome_email_queue q
  set status = 'sending', attempts = q.attempts + 1
  where q.id in (
    select id from public.welcome_email_queue
    where status = 'pending' and fire_at <= now()
    order by fire_at
    limit greatest(1, least(coalesce(p_limit, 10), 25))
    for update skip locked
  )
  returning q.*
$$;

revoke all on function public.claim_due_welcome_emails(int) from public, anon, authenticated;
grant execute on function public.claim_due_welcome_emails(int) to service_role;

grant select, insert, update, delete on public.welcome_email_queue to service_role;
