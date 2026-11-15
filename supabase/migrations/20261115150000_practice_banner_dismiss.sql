-- 2026-11-15: dismissible practice-pricing banner on the pricing library page.
-- Owner request: banner text is "too intense" to see every visit; users may hide it.
-- Nullable additive column on the existing per-user progress table (same pattern
-- as dismiss_component_edit_warning). Absent/false = show the banner.
ALTER TABLE copilot_progress
  ADD COLUMN IF NOT EXISTS dismiss_practice_pricing_banner boolean;
