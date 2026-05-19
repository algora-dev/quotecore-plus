-- Gerald audit M-03: lock down support_tickets workflow tampering.
--
-- Original RLS policies let any user UPDATE any column on their own
-- non-closed tickets, including status, priority, category, assignee,
-- resolved_at, related_stripe_dispute_id, related_stripe_charge_id,
-- auto_close_at, and created_by_system. That weakens the support
-- workflow (user can self-resolve / re-prioritise / re-categorise) and
-- breaks payment-dispute integrity (user can detach a dispute or
-- backdate auto-close).
--
-- Strategy mirrors the companies billing-lockdown (C-01):
--   1. Revoke broad UPDATE on public.support_tickets from authenticated.
--   2. Whitelist UPDATE on only the columns user-context server actions
--      legitimately edit:
--        - email_forwarded_at, email_forward_error (set by the
--          createSupportTicket flow after Resend completes)
--        - messages (append-only user-reply, future feature)
--        - updated_at
--   3. Keep the RLS policy unchanged so even whitelisted writes remain
--      tenant-scoped + non-closed.
--   4. INSERT remains via the existing RLS policy (own user + own
--      company). DELETE remains denied for authenticated.
--   5. Service-role unaffected (admin tools can still mutate
--      status/priority/etc).

BEGIN;

REVOKE UPDATE ON public.support_tickets FROM anon;
REVOKE UPDATE ON public.support_tickets FROM authenticated;

GRANT UPDATE (
  email_forwarded_at,
  email_forward_error,
  messages,
  updated_at
) ON public.support_tickets TO authenticated;

-- DELETE is admin-only; existing rls policy already enforces this but we
-- restate the revoke for clarity.
REVOKE DELETE ON public.support_tickets FROM anon;
REVOKE DELETE ON public.support_tickets FROM authenticated;

COMMIT;
