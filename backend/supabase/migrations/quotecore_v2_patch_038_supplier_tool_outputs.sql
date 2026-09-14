-- Lightweight supplier-tool output tracking (Shaun, 2026-09-14).
-- One row per completed output in any /supplier-pricing-tool demo:
-- tool slug + timestamp + snapshot payload, plus a server-generated
-- PDF stored in a private bucket so we can see exactly what was tested.
-- Fire-and-forget from the client; no user data beyond what the tool
-- already computes (products, quantities, totals).

create table if not exists public.supplier_tool_outputs (
  id uuid primary key default gen_random_uuid(),
  tool_slug text not null,
  trade text,
  currency text,
  total_material numeric,
  total_labour numeric,
  item_count int,
  payload jsonb,
  pdf_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_supplier_tool_outputs_slug_time
  on public.supplier_tool_outputs (tool_slug, created_at desc);

-- Private bucket for the output PDFs (service-role access only).
insert into storage.buckets (id, name, public)
values ('supplier-tool-outputs', 'supplier-tool-outputs', false)
on conflict (id) do nothing;
