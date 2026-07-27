-- Add contact_email and phone_number to supplier_profiles
-- contact_email: public-facing email for customers to contact the supplier
-- phone_number: public-facing phone number for the supplier
-- These are separate from master_email (which is the login account email)

ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS phone_number text;
