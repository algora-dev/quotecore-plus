-- Allow authenticated users to DELETE outbound messages belonging to
-- their own company. Phase 1 shipped only a SELECT policy, so the
-- delete-message UX on the quote summary page silently returned 0
-- rows ("Message not found.") — RLS was filtering the DELETE.
--
-- Cascade behaviour is unchanged: outbound_message_replies has
-- ON DELETE CASCADE on message_id (and is service-role-write only,
-- which still permits cascaded deletes triggered by a user DELETE on
-- the parent — Postgres handles cascades with the parent's privileges).
--
-- 2026-05-13 Shaun smoke-test feedback: "delete messages on quote
-- summary page not working, says message can't be found".

DROP POLICY IF EXISTS outbound_messages_delete_own_company ON public.outbound_messages;

CREATE POLICY outbound_messages_delete_own_company
  ON public.outbound_messages
  FOR DELETE
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

COMMENT ON POLICY outbound_messages_delete_own_company ON public.outbound_messages IS
  'Allow users to hard-delete outbound messages within their own company. Replies cascade via FK ON DELETE CASCADE.';
