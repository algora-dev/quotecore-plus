-- 20260706120000_per_entry_pitch.sql
-- Store pitch per child area entry, not just at parent area level.
-- The parent's calc_pitch_degrees becomes a "default" set when the first
-- area is created; individual entries keep the pitch the user drew them with.

-- 1. Add pitch_degrees column to quote_roof_area_entries
ALTER TABLE public.quote_roof_area_entries
  ADD COLUMN IF NOT EXISTS pitch_degrees numeric(5,2) DEFAULT 0;

-- 2. Backfill existing entries from their parent area's pitch
UPDATE public.quote_roof_area_entries e
  SET pitch_degrees = COALESCE(
    (SELECT calc_pitch_degrees FROM public.quote_roof_areas WHERE id = e.quote_roof_area_id),
    0
  )
  WHERE e.pitch_degrees IS NULL OR e.pitch_degrees = 0;
