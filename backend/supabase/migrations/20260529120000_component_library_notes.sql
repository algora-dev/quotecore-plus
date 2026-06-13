-- Add notes field to component_library.
-- Users can write short explainers or usage tips on a component.
-- Displayed when a component is expanded/clicked in the component library UI.
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

COMMENT ON COLUMN public.component_library.notes IS
  'Optional short notes or usage tips for this component, written by the company owner.';
