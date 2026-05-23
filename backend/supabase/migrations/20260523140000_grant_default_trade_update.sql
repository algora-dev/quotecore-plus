-- Add default_trade to the companies column-level UPDATE whitelist.
-- Migration 20260519100000 locked down companies to explicit column grants;
-- default_trade was added after that migration and was never whitelisted,
-- causing a 500 on every Company Settings save that includes the trade field.
GRANT UPDATE (default_trade) ON public.companies TO authenticated;
