-- Demo AI switch check callable from the edge (middleware) without the
-- service key. SECURITY DEFINER reads demo_control internally; anon callers
-- learn ONLY the combined on/off boolean (no other demo_control exposure).
CREATE OR REPLACE FUNCTION public.demo_ai_enabled()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT demo_enabled AND ai_enabled FROM public.demo_control WHERE id = 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.demo_ai_enabled() TO anon, authenticated;

-- VERIFY: select public.demo_ai_enabled();  -- expect false while ai_enabled=false
