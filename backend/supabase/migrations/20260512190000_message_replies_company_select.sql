-- Allow SELECT on outbound_message_replies for the row's company.
--
-- Phase 1 shipped this table with a deny-all RLS so writes had to go via
-- service-role (the public reply flow is anonymous). For the quote
-- summary's expandable Sent Messages panel we need authenticated users
-- to read their own company's replies. Writes stay service-role-only
-- (no INSERT/UPDATE/DELETE policy here).
--
-- 2026-05-12 Shaun feedback: expandable message rows must show the
-- action + reply body inline.

DROP POLICY IF EXISTS outbound_message_replies_no_user_access ON public.outbound_message_replies;

CREATE POLICY outbound_message_replies_select_own_company
  ON public.outbound_message_replies
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

COMMENT ON TABLE public.outbound_message_replies IS
  'Structured replies from the public /m/[token] page. SELECT scoped to caller company via RLS; INSERT only via service role (public reply flow is anonymous).';
