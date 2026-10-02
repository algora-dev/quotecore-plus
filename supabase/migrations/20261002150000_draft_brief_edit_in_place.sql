-- Edit-in-place for Smart Assistant draft workflows (owner rule 2026-10-02):
-- a confirmed brief is bound to the quote it produced so later change turns
-- update that quote instead of spawning a second draft.
alter table public.assistant_v2_draft_briefs
  add column if not exists produced_quote_id uuid references public.quotes(id);

-- Trusted helper used by the confirm path to clear a draft's child rows so
-- the existing creation-finish invariants (empty parent) hold for edits.
-- Hard-guarded: service role only, and only for a manual draft quote.
create or replace function public.sa_v2_draft_edit_clear(p_quote_id uuid, p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'trusted_only' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.quotes
    where id = p_quote_id and company_id = p_company_id
      and status = 'draft' and entry_mode = 'manual'
  ) then
    raise exception 'not_editable' using errcode = '42501';
  end if;
  delete from public.quote_component_entries
   where quote_component_id in (select id from public.quote_components where quote_id = p_quote_id);
  delete from public.quote_components where quote_id = p_quote_id;
  delete from public.quote_roof_areas where quote_id = p_quote_id;
end;
$$;
