-- Patch 001: Pitch type enum + quote global pitch
-- Run after v2 schema + RLS

-- Add pitch_type enum
DO $$ BEGIN
  CREATE TYPE pitch_type AS ENUM ('none', 'rafter', 'valley_hip');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Replace boolean pitch column with enum on component_library
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS default_pitch_type pitch_type NOT NULL DEFAULT 'none';

-- Migrate existing boolean data then drop old column
UPDATE public.component_library
  SET default_pitch_type = CASE WHEN default_pitch_applies = true THEN 'rafter' ELSE 'none' END
  WHERE default_pitch_type = 'none' AND default_pitch_applies = true;

ALTER TABLE public.component_library
  DROP COLUMN IF EXISTS default_pitch_applies;

-- Add pitch_type to template_components overrides
ALTER TABLE public.template_components
  ADD COLUMN IF NOT EXISTS override_pitch_type pitch_type;

-- Drop old boolean override
ALTER TABLE public.template_components
  DROP COLUMN IF EXISTS override_pitch_applies;

-- Add pitch_type to quote_components
ALTER TABLE public.quote_components
  ADD COLUMN IF NOT EXISTS pitch_type pitch_type NOT NULL DEFAULT 'none';

-- Drop old boolean
ALTER TABLE public.quote_components
  DROP COLUMN IF EXISTS is_pitch_overridden;

-- Add pitch override flag back as proper boolean
ALTER TABLE public.quote_components
  ADD COLUMN IF NOT EXISTS is_pitch_overridden boolean NOT NULL DEFAULT false;

-- Add global pitch to quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS global_pitch_degrees numeric(8,4);

-- Drop pricing_unit from component_library (derived from measurement_type now)
ALTER TABLE public.component_library
  DROP COLUMN IF EXISTS pricing_unit;
