-- Fix Prime Roofing test data: branch_city was "Auckland" but country was "US"
-- Auckland is in NZ, not US. Update to a consistent US city.
UPDATE public.supplier_profiles
  SET branch_city = 'Los Angeles',
      branch_region = 'CA',
      branch_country = 'US',
      country = 'US'
  WHERE id = '08f991a6-8a4b-4a15-994c-e35c2dddb30b';
