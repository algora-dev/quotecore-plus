-- Add allow_custom_pricing to supplier_profiles
-- When false (default): users on supplier's branded takeoff tool only see the component dropdown (supplier's products)
-- When true: users also get the "add known price" option alongside the dropdown

ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS allow_custom_pricing boolean NOT NULL DEFAULT false;
