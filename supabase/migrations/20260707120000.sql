-- 20260707120000: Per-user dismiss for component edit warning modal.
-- Adds a boolean column to copilot_progress so we can persist the
-- "Don't show me this warning anymore" preference per user.

ALTER TABLE public.copilot_progress
  ADD COLUMN IF NOT EXISTS dismiss_component_edit_warning boolean NOT NULL DEFAULT false;
