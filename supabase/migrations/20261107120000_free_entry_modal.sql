-- Free Workspace first-entry modal (owner 2026-11-07): company-level one-time
-- stamp for the "Welcome to your free workspace" dialog (what free includes,
-- where the limits sit, guided-demo recommendation). Additive + nullable
-- (standing permission); service-role read/write only.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS free_entry_modal_action text,
  ADD COLUMN IF NOT EXISTS free_entry_modal_seen_at timestamptz;

COMMENT ON COLUMN public.companies.free_entry_modal_action IS 'One-time entry-modal choice: start_demo | continue (first stamp wins; shows once per account).';
COMMENT ON COLUMN public.companies.free_entry_modal_seen_at IS 'When the Free Workspace entry-modal choice was recorded.';
