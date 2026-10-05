-- Feedback questionnaire (2026-09-17, Shaun)
-- Public feedback form at quote-core.com/feedback, surfaced in the admin panel.
-- Written by the service role only via /api/feedback; no client policies.

create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  email text,
  wants_response boolean not null default false,
  anything_stopping text check (anything_stopping in ('yes', 'no')),
  stopping_reason text,
  stopping_reason_other text,
  liked_features text[] not null default '{}',
  disliked_features text[] not null default '{}',
  feature_comment text,
  improvement_wish text,
  source text not null default 'public-feedback-page',
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;

-- Optional index for the admin list (newest first by email)
create index if not exists idx_feedback_submissions_created_at
  on public.feedback_submissions (created_at desc);
