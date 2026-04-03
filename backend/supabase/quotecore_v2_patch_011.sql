-- Patch 011: Component library display defaults
-- Adds default display preferences for customer quotes

-- Add display default columns to component_library
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS show_price_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_dimensions_default boolean NOT NULL DEFAULT true;

-- Comments
COMMENT ON COLUMN public.component_library.show_price_default IS 
  'Default setting for showing price on customer quotes. Can be overridden per quote line.';

COMMENT ON COLUMN public.component_library.show_dimensions_default IS 
  'Default setting for showing dimensions (area/linear) on customer quotes. Can be overridden per quote line.';

-- Update existing components to show both by default
-- (This is a safe default - users can customize later)
UPDATE public.component_library
SET 
  show_price_default = true,
  show_dimensions_default = true
WHERE show_price_default IS NULL OR show_dimensions_default IS NULL;

-- Add show_dimensions column to customer_quote_lines
ALTER TABLE public.customer_quote_lines
  ADD COLUMN IF NOT EXISTS show_dimensions boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.customer_quote_lines.show_dimensions IS 
  'Whether to display dimensions (area/linear) for this line in the customer quote.';
