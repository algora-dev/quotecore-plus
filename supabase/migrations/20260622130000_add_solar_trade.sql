-- Add 'solar' to the trade enum so the company settings / onboarding can
-- select Solar as a default industry. Additive: existing rows unaffected.
ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'solar';
