-- Tighten quote_notes length caps: title 100 chars, body 2000 chars.
-- Replaces the 200/10000 caps from 20260615120000 (already applied).

ALTER TABLE public.quote_notes
  DROP CONSTRAINT IF EXISTS quote_notes_title_length,
  DROP CONSTRAINT IF EXISTS quote_notes_body_length;

ALTER TABLE public.quote_notes
  ADD CONSTRAINT quote_notes_title_length CHECK (char_length(title) <= 100),
  ADD CONSTRAINT quote_notes_body_length CHECK (char_length(body) <= 2000);
