-- Invoice line display toggles (show/hide description, quantity)
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS show_description BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS show_quantity   BOOLEAN NOT NULL DEFAULT TRUE;
