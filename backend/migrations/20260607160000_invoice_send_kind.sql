-- Migration: add invoice_send to kind CHECK constraints
-- Affects: email_templates.kind, outbound_messages.kind
-- This allows invoice_send to be used as a template kind and outbound message kind.
-- Uses a DO block to find + drop existing check constraints by expression
-- (names are auto-generated and may vary across environments).

DO $$
DECLARE
  cname text;
BEGIN
  -- email_templates: drop existing kind check constraint
  SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'public.email_templates'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%quote_send%'
    LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.email_templates DROP CONSTRAINT %I', cname);
  END IF;

  -- outbound_messages: drop existing kind check constraint
  SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'public.outbound_messages'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%quote_send%'
    LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.outbound_messages DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Re-add constraints with invoice_send included
ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_kind_check
  CHECK (kind IN ('quote_send', 'order_send', 'invoice_send', 'followup', 'decline_response', 'custom'));

ALTER TABLE public.outbound_messages
  ADD CONSTRAINT outbound_messages_kind_check
  CHECK (kind IN ('quote_send', 'order_send', 'invoice_send', 'followup', 'decline_response', 'custom'));
