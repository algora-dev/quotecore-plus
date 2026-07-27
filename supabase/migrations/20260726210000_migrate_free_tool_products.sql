-- Phase 5: Migrate current free-tool supplier products into the shared component system
-- 0. Make company_id nullable (roof-takeoff-platform has no companies table)
-- 1. Backfill takeoff_slot on roof_components based on component_kind
-- 2. Dedupe duplicate default components (keep one per kind for tenant_id=NULL)
-- 3. Create supplier profiles for demo tenants
-- 4. Link tenant demo components to supplier profiles

-- Step 0: Allow standalone supplier profiles (no company required)
ALTER TABLE public.supplier_profiles ALTER COLUMN company_id DROP NOT NULL;

-- Step 1: Backfill takeoff_slot from component_kind
UPDATE public.roof_components SET takeoff_slot = component_kind WHERE takeoff_slot IS NULL;

-- Step 1b: Backfill free_tool_roof_components (add takeoff_slot column if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'free_tool_roof_components' AND column_name = 'takeoff_slot'
  ) THEN
    ALTER TABLE public.free_tool_roof_components ADD COLUMN takeoff_slot text;
  END IF;
END $$;

UPDATE public.free_tool_roof_components SET takeoff_slot = component_kind WHERE takeoff_slot IS NULL;

-- Step 2: Dedupe duplicate default components (tenant_id IS NULL)
-- Keep the one with the lowest created_at per (component_kind, name)
DELETE FROM public.roof_components
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY component_kind, name, tenant_id
        ORDER BY created_at ASC
      ) as rn
    FROM public.roof_components
    WHERE tenant_id IS NULL
  ) t WHERE rn > 1
);

-- Step 3: Create supplier profiles for demo tenants
INSERT INTO public.supplier_profiles (supplier_name, slug, status, website_url, description, approved_at, approved_by)
VALUES
  ('Apex Roofing', 'apex-roofing', 'approved', NULL, 'Demo supplier - Apex Roofing components', now(), 'admin'),
  ('Roofing Industries', 'roofing-industries', 'approved', NULL, 'Demo supplier - Roofing Industries NZ components', now(), 'admin')
ON CONFLICT (supplier_name) DO NOTHING;

-- Step 4: Link tenant demo components to supplier profiles
UPDATE public.roof_components rc
SET supplier_profile_id = sp.id
FROM public.supplier_profiles sp
WHERE rc.tenant_id = 'apex-roofing' AND sp.slug = 'apex-roofing';

UPDATE public.roof_components rc
SET supplier_profile_id = sp.id
FROM public.supplier_profiles sp
WHERE rc.tenant_id = 'roofing-industries' AND sp.slug = 'roofing-industries';
