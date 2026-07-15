-- Free-tools draft handoff storage (2026-07-15).
--
-- WHY: free tools live on quote-core.com; the app lives on
-- app.quote-core.com. Drafts used to be carried in localStorage, which is
-- per-origin — a draft saved on the marketing domain was invisible to the
-- dashboard on the app domain, so "Save to App" lost the user's document
-- whenever the journey crossed domains (T1/T2 signup flows).
--
-- Drafts are now persisted server-side keyed by an unguessable UUID. The
-- UUID travels through the signup/onboarding redirects via URL param +
-- cookie; the dashboard fetches the payload back by ID.
--
-- Access model: service-role only (API routes). No RLS policies on
-- purpose — anon/authenticated PostgREST access stays fully blocked; the
-- draft ID acts as a capability token, and reads additionally require an
-- authenticated app session at the API layer.

create table if not exists public.free_document_drafts (
  id uuid primary key default gen_random_uuid(),
  -- 'document' = quote/invoice/order generator drafts,
  -- 'smart_component' = calculator Smart Component drafts.
  draft_type text not null default 'document'
    check (draft_type in ('document', 'smart_component')),
  payload jsonb not null,
  email text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  consumed_at timestamptz
);

alter table public.free_document_drafts enable row level security;

-- Cleanup helper index (expired-draft pruning + lookups).
create index if not exists free_document_drafts_expires_idx
  on public.free_document_drafts (expires_at);
