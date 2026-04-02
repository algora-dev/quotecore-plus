-- Patch 007: Imperial/Metric measurement system support
-- Run after patch 006

-- Create measurement_system enum
CREATE TYPE measurement_system AS ENUM ('metric', 'imperial');

-- Add default_measurement_system to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_measurement_system measurement_system DEFAULT 'metric' NOT NULL;

-- Add measurement_system to quotes (locked at creation)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS measurement_system measurement_system DEFAULT 'metric' NOT NULL;

COMMENT ON COLUMN public.companies.default_measurement_system IS 
  'Default measurement system for new quotes. Metric (m, m²) or Imperial (ft, roofing squares).';

COMMENT ON COLUMN public.quotes.measurement_system IS 
  'Measurement system locked at quote creation. All values stored metric canonically, converted for display.';
