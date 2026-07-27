-- Fix: Grant UPDATE on component_collections to authenticated role
-- The authenticated role was missing UPDATE privilege, causing
-- "permission denied for table component_collections" when suppliers
-- tried to publish libraries.

GRANT UPDATE ON public.component_collections TO authenticated;
