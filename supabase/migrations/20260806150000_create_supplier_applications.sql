-- Supplier partner applications table
-- Stores applications submitted via the supplier-partnership page modal form

CREATE TABLE IF NOT EXISTS public.supplier_applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  has_account BOOLEAN NOT NULL DEFAULT FALSE,
  account_email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  website TEXT,
  contact_person TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  location TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','accepted','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (insert) an application — no auth required
CREATE POLICY "Anyone can submit supplier application"
  ON public.supplier_applications
  FOR INSERT WITH CHECK (true);

-- Only service role can read (admin panel uses service role key)
CREATE POLICY "Only service role can read supplier applications"
  ON public.supplier_applications
  FOR SELECT USING (false);

-- Only service role can update (status changes from admin)
CREATE POLICY "Only service role can update supplier applications"
  ON public.supplier_applications
  FOR UPDATE USING (false);
