-- Free Roof Takeoff tool: allow draft_type = 'takeoff' in free_document_drafts.
-- Additive change - extends the existing check constraint only.

ALTER TABLE public.free_document_drafts
  DROP CONSTRAINT free_document_drafts_draft_type_check;

ALTER TABLE public.free_document_drafts
  ADD CONSTRAINT free_document_drafts_draft_type_check
  CHECK (draft_type = ANY (ARRAY['document', 'smart_component', 'takeoff']));
