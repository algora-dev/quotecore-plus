-- Patch 055: enable RLS on supplier_tool_outputs (Supabase linter finding, 2026-09-22).
-- The table is written ONLY by the service role (free-tools output log route,
-- SUPABASE_SERVICE_ROLE_KEY), which bypasses RLS. Enabling RLS with no
-- policies closes anonymous/authenticated read+write via PostgREST while
-- leaving the route untouched. Zero data changes, additive only.

alter table public.supplier_tool_outputs enable row level security;
