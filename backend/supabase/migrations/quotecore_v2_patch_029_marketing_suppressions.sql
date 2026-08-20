-- Marketing unsubscribe list for agent-sent emails.
-- Separate from message_suppressions (company-scoped) because these
-- opt-outs come from the public /unsubscribe/<token> page with no company
-- context. Additive only.

CREATE TABLE IF NOT EXISTS public.marketing_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'agent_email'
);

-- Block-level grant: the app uses the service role (bypasses these), and
-- anon/authenticated get nothing - reads/writes happen only in server code.
REVOKE ALL ON public.marketing_suppressions FROM anon, authenticated;
