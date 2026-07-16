-- free_tool_usage: tracks every free-tool parse call for admin analytics.
-- One row per parse-document API call. Supports T1 (anonymous), T2 (authed
-- no company), and T3 (fully onboarded) reporting.
CREATE TABLE IF NOT EXISTS public.free_tool_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- What tool was used
  tool_code   text NOT NULL,          -- 'roofing', 'construction', 'concrete', 'landscaping', 'birdsmouth', 'quote-gen', 'invoice-gen', 'po-gen'
  tool_name   text NOT NULL,          -- human-readable, e.g. 'Roofing Calculator'
  parse_mode  text NOT NULL,          -- 'image' | 'text'
  document_type text NOT NULL,        -- 'quote' | 'order' | 'invoice'
  -- Who used it (nullable for anonymous T1)
  tier        smallint NOT NULL,      -- 1, 2, or 3
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  text,
  ip_address  text,                   -- only for T1 anonymous, NULL for authed
  -- Denormalised for fast queries without joins
  has_app_account boolean NOT NULL DEFAULT false
);

-- Indexes for the admin queries
CREATE INDEX IF NOT EXISTS idx_free_tool_usage_tier ON public.free_tool_usage (tier);
CREATE INDEX IF NOT EXISTS idx_free_tool_usage_user_id ON public.free_tool_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_free_tool_usage_created_at ON public.free_tool_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_free_tool_usage_tool_code ON public.free_tool_usage (tool_code);

-- RLS: this table is admin-only. No public access.
ALTER TABLE public.free_tool_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY free_tool_usage_admin_only ON public.free_tool_usage
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_admin = true
    )
  );

-- The parse-document route runs with service_role (bypasses RLS) so it can
-- insert freely. Admin reads also use service_role via createAdminClient().
