-- Patch 003: Plan/Actual + Global/Custom pitch per component
ALTER TABLE public.quote_components
  ADD COLUMN IF NOT EXISTS use_custom_pitch boolean NOT NULL DEFAULT false;

ALTER TABLE public.quote_components
  ADD COLUMN IF NOT EXISTS custom_pitch_degrees numeric(8,4);
