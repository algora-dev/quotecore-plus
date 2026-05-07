-- Quote withdrawal: a user can mint an acceptance URL, send it, then change
-- their mind (typo, wrong customer, scope changed, customer ghosted, etc.).
-- Withdrawing nullifies the active token so the public link stops working
-- and the customer sees the "request a fresh quote" CTA instead.
--
-- Design rule: a quote can have at most ONE live token at a time. To send
-- a new link, the user must explicitly withdraw the old one. We keep an
-- audit trail (withdrawn_at + withdrawn_by_user_id) so we can answer "what
-- happened to that link?" later.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS withdrawn_by_user_id UUID
    REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN quotes.withdrawn_at IS 'Timestamp the user withdrew the active acceptance link. While set, the link is dead and the public page shows the re-quote CTA.';
COMMENT ON COLUMN quotes.withdrawn_by_user_id IS 'User who withdrew the acceptance link.';
