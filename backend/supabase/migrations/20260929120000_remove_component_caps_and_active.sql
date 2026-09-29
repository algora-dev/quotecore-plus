-- Remove the Smart Component active/inactive system and plan component caps (owner decision 2026-09-29).
-- Scope: component_library ONLY. The flashing_library cap trigger is intentionally untouched.
-- Non-destructive: is_active column remains but nothing enforces or filters on it after this;
-- all existing rows are made active so every component is visible and usable.

BEGIN;

-- Drop the H-04 component cap triggers and their functions.
DROP TRIGGER IF EXISTS component_library_enforce_cap ON public.component_library;
DROP TRIGGER IF EXISTS component_library_enforce_cap_reactivate ON public.component_library;
DROP FUNCTION IF EXISTS public.tg_enforce_component_cap();
DROP FUNCTION IF EXISTS public.tg_enforce_component_cap_reactivate();

-- Reactivate every inactive component (triggers are gone, so no cap fires).
UPDATE public.component_library SET is_active = true WHERE is_active IS DISTINCT FROM true;

COMMIT;
