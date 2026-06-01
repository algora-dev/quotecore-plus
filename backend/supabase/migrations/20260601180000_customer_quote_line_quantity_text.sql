-- Fix #5 (Attachments post-smoke-test batch): catalog-line "Units" toggle.
--
-- Problem: the show/hide "Units" toggle on customer quote lines hides the
-- quantity by string-splitting the line text on the first hyphen. Component
-- lines use "<name> - <qty> <unit>" so the split works, but catalog-search
-- lines join description + quantity with an EM DASH (" — "), so the hyphen
-- split never matches and the quantity is never hidden. The split is also
-- fragile for any description that itself contains a hyphen.
--
-- Fix: store the toggle-able quantity portion in its own nullable column.
-- When `quantity_text` IS NOT NULL the renderer treats `custom_text` as the
-- always-shown description and `quantity_text` as the part the Units toggle
-- hides - no string splitting. When it IS NULL (all existing rows + component
-- lines) the renderer keeps the legacy hyphen-strip behaviour, so nothing
-- changes for current data.
--
-- Nullable, no backfill, no default: purely additive and backwards-compatible.

ALTER TABLE public.customer_quote_lines
  ADD COLUMN IF NOT EXISTS quantity_text text;

COMMENT ON COLUMN public.customer_quote_lines.quantity_text IS
  'Optional toggle-able quantity/units portion for catalog-sourced lines. When set, custom_text is the always-shown description and this is hidden when show_units=false. NULL = legacy lines that strip units from custom_text via hyphen split.';
