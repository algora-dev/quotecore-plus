-- Add volume_3d measurement type.
-- This is the "true volume" type where the user enters all 3 dimensions
-- (L × W × D) per measurement. Distinct from the existing 'volume' type
-- which uses a preset depth stored on the component_library row.
-- The display name for the old 'volume' type is now "Volume (Preset Depth)"
-- and the new 'volume_3d' displays simply as "Volume".
ALTER TYPE public.measurement_type ADD VALUE IF NOT EXISTS 'volume_3d';
