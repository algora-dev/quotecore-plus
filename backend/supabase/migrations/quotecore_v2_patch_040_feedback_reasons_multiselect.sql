-- Feedback form v2 (2026-09-17, Shaun): stopping reasons are now multi-select.
alter table public.feedback_submissions
  alter column stopping_reason type text[]
  using case when stopping_reason is null then null else array[stopping_reason] end;
