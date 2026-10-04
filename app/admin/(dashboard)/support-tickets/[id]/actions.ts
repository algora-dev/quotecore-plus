'use server';

/**
 * Server actions for the admin support-ticket detail view
 * (/admin/support-tickets/[id]).
 *
 * Gating: `requireAdmin()` checks `users.is_admin`; the service-role
 * client afterwards can read/write every company's tickets.
 *
 * Messages live in the `support_tickets.messages` Json column as an
 * array of { role: 'admin' | 'user', body, at, author? }. Admin replies
 * are also emailed to the user (best-effort, same pattern as the
 * forward-to-inbox on ticket creation).
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { sendEmail } from '@/app/lib/email/send';
import type { Json } from '@/app/lib/supabase/database.types';
import { parseSupportMessages } from './support-messages';

export type AdminTicketActionResult =
  | { ok: true }
  | { ok: false; error: string };

const SUPPORT_INBOX = 'info@quote-core.com';

const VALID_STATUSES = ['open', 'pending', 'resolved'] as const;
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

/**
 * Append an admin reply to the thread. Replying to an open or resolved
 * ticket moves it to `pending` (awaiting the user); a pending ticket
 * stays pending. The user gets an email copy of the reply.
 */
export async function replyToSupportTicket(
  ticketId: string,
  body: string,
): Promise<AdminTicketActionResult> {
  const adminProfile = await requireAdmin();
  const trimmed = (body ?? '').trim();
  if (trimmed.length < 2) return { ok: false, error: 'Reply is empty.' };
  if (trimmed.length > 8000) return { ok: false, error: 'Reply is too long (8,000 characters max).' };

  const supabase = createAdminClient();
  const { data: ticket, error: loadErr } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, messages, user_id, company_id')
    .eq('id', ticketId)
    .maybeSingle();
  if (loadErr || !ticket) return { ok: false, error: 'Ticket not found.' };

  const messages = parseSupportMessages(ticket.messages);
  messages.push({
    role: 'admin',
    body: trimmed,
    at: new Date().toISOString(),
    author: adminProfile.email,
  });

  // Any admin reply means the ball is back in the user's court.
  const nextStatus = 'pending';
  const { error: updateErr } = await supabase
    .from('support_tickets')
    .update({
      messages: messages as unknown as Json,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Best-effort email copy to the user. Never blocks the in-app reply.
  void (async () => {
    try {
      const [{ data: user }, { data: company }] = await Promise.all([
        supabase.from('users').select('email, full_name').eq('id', ticket.user_id).maybeSingle(),
        supabase.from('companies').select('name').eq('id', ticket.company_id).maybeSingle(),
      ]);
      if (!user?.email) return;

      const text = [
        `Hi ${user.full_name ?? 'there'},`,
        '',
        trimmed,
        '',
        '- QuoteCore+ Support',
        '',
        `You can also view this ticket in the app: Account > Support.`,
      ].join('\n');

      const escape = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');

      await sendEmail({
        to: user.email,
        replyTo: SUPPORT_INBOX,
        subject: `Re: ${ticket.subject}`,
        text,
        html: `<div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #0f172a; line-height: 1.5;">
          <p style="font-weight:600; margin:0 0 12px;">Re: ${escape(ticket.subject)}</p>
          <p style="margin:0 0 16px; white-space:pre-wrap;">${escape(trimmed)}</p>
          <p style="margin:0; color:#64748b; font-size:13px;">- QuoteCore+ Support${company?.name ? ` (ticket ${ticket.id.slice(0, 8)})` : ''}</p>
        </div>`,
        tags: [
          { name: 'kind', value: 'support_reply' },
          { name: 'category', value: ticket.category },
        ],
      });
    } catch (err) {
      console.warn('[admin/support] reply email failed:', err);
    }
  })();

  console.log(`[admin/support] reply: admin=${adminProfile.id} ticket=${ticketId}`);
  revalidatePath(`/admin/support-tickets/${ticketId}`);
  revalidatePath('/admin/support-tickets');
  return { ok: true };
}

export async function setSupportTicketStatus(
  ticketId: string,
  status: string,
): Promise<AdminTicketActionResult> {
  await requireAdmin();
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return { ok: false, error: 'Invalid status.' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('support_tickets')
    .update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/support-tickets/${ticketId}`);
  revalidatePath('/admin/support-tickets');
  return { ok: true };
}

export async function setSupportTicketPriority(
  ticketId: string,
  priority: string,
): Promise<AdminTicketActionResult> {
  await requireAdmin();
  if (!VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
    return { ok: false, error: 'Invalid priority.' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('support_tickets')
    .update({ priority, updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/support-tickets/${ticketId}`);
  revalidatePath('/admin/support-tickets');
  return { ok: true };
}
