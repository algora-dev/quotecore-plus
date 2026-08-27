-- Free Tools: Smart Tool Finder query intelligence (Ron's hub redesign).
-- Append-only event stream: one row per finder query, one row per
-- recommendation click; joined via session_id + timestamp window.
-- Writes only via app/api/free-tools/finder-event (service role).
-- No client access at all: RLS on, grants revoked, no policies.

create table if not exists public.free_tool_finder_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- explicit row kind so analysis never infers type from null fields
  event_type text not null default 'query' check (event_type in ('query', 'click')),
  session_id text not null,
  raw_query_sanitised text,
  normalised_query text,
  query_category text,
  match_method text not null default 'deterministic' check (match_method in ('deterministic', 'ai')),
  confidence_score int,
  recommended_tool_ids text[],
  clicked_tool_id text,
  clicked_position int,
  no_match boolean not null default false
);

alter table public.free_tool_finder_events enable row level security;

revoke all on public.free_tool_finder_events from anon, authenticated;

create index if not exists free_tool_finder_events_created_at_idx
  on public.free_tool_finder_events (created_at desc);
create index if not exists free_tool_finder_events_category_idx
  on public.free_tool_finder_events (query_category, created_at desc);
