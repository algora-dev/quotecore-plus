'use server';

/**
 * Server actions for the Account > Support tab.
 *
 * Phase 1 (now): users create tickets, view their own list, post follow-ups.
 * Phase 2 (later): admin backend at /admin/support reads/replies and flips
 * status. We deliberately keep the user surface narrow here \u2014 the user can
 * only `open` or `pending` tickets, and even then can only append messages.
 *
 * Email forwarding to info@quote-core.com is best-effort and runs after the
 * DB insert. If Resend fails we still keep the ticket; the failure is logged
 * to `email_forward_error` on the row so the admin tools can surface it.
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { sendEmail } from '@/app/lib/email/send';

export type TicketCategory = 'bug' | 'question' | 'billing' | 'feature_request' | 'other';

const VALID_CATEGORIES: TicketCategory[] = ['bug', 'question', 'billing', 'feature_request', 'other'];

const SUPPORT_INBOX = 'info@quote-core.com';

export interface CreateTicketInput {
  subject: string;
  body: string;
  category: TicketCategory;
  /** App route the user was on when they hit Submit. Helps reproduce bugs. */
  pageContext?: string | null;
  /** navigator.userAgent. */
  userAgent?: string | null;
}

export interface TicketSummary {
  id: string;
  subject: string;
  category: TicketCategory;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  message_count: number;
}

/**
 * Server-side validation. Mirrors the DB CHECK constraints so a malformed
 * client payload never reaches Supabase.
 */
function validateTicketInput(input: CreateTicketInput): string | null {
  const subject = (input.subject ?? '').trim();
  const body = (input.body ?? '').trim();
  if (subject.length < 3) return 'Subject must be at least 3 characters.';
  if (subject.length > 200) return 'Subject must be 200 characters or fewer.';
  if (body.length < 5) return 'Please describe your issue in a bit more detail.';
  if (body.length > 8000) return 'Message is too long. Please keep it under 8000 characters.';
  if (!VALID_CATEGORIES.includes(input.category)) return 'Invalid category.';
  return null;
}

export async function createSupportTicket(input: CreateTicketInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const validationError = validateTicketInput(input);
  if (validationError) return { ok: false, error: validationError };

  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Fetch the user's email + company name for the notification email body.
  const [{ data: user }, { data: company }] = await Promise.all([
    supabase.from('users').select('email, full_name').eq('id', profile.id).single(),
    supabase.from('companies').select('name').eq('id', profile.company_id).single(),
  ]);

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      company_id: profile.company_id,
      user_id: profile.id,
      subject: input.subject.trim(),
      body: input.body.trim(),
      category: input.category,
      page_context: input.pageContext?.slice(0, 500) ?? null,
      user_agent: input.userAgent?.slice(0, 500) ?? null,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    })
    .select('id, subject, body, category, created_at')
    .single();

  if (error || !ticket) {
    console.error('[support] insert failed:', error?.message);
    return { ok: false, error: `Could not save your ticket: ${error?.message ?? 'unknown error'}` };
  }

  // Best-effort email forwarding to the support inbox. We DON'T await this
  // before returning success to the user \u2014 they get the confirmation as soon
  // as the DB row exists, and the email lands moments later.
  void forwardTicketEmail({
    ticketId: ticket.id,
    subject: ticket.subject,
    body: ticket.body,
    category: ticket.category as TicketCategory,
    createdAt: ticket.created_at,
    userEmail: user?.email ?? null,
    userName: user?.full_name ?? null,
    companyName: company?.name ?? null,
    pageContext: input.pageContext ?? null,
  });

  revalidatePath('/account', 'page');
  return { ok: true, id: ticket.id };
}

interface ForwardArgs {
  ticketId: string;
  subject: string;
  body: string;
  category: TicketCategory;
  createdAt: string;
  userEmail: string | null;
  userName: string | null;
  companyName: string | null;
  pageContext: string | null;
}

async function forwardTicketEmail(args: ForwardArgs): Promise<void> {
  const subjectPrefix: Record<TicketCategory, string> = {
    bug: '[Bug]',
    question: '[Question]',
    billing: '[Billing]',
    feature_request: '[Feature]',
    other: '[Support]',
  };

  const subject = `${subjectPrefix[args.category]} ${args.subject}`;

  // Plain-text version (deliverability + email clients that strip HTML).
  const text = [
    `New support ticket: ${args.ticketId}`,
    '',
    `From: ${args.userName ?? '(no name)'} <${args.userEmail ?? 'unknown'}>`,
    `Company: ${args.companyName ?? '(no company)'}`,
    `Category: ${args.category}`,
    args.pageContext ? `Page: ${args.pageContext}` : null,
    '',
    'Message:',
    args.body,
    '',
    `Submitted at ${args.createdAt}`,
  ].filter(Boolean).join('\n');

  // HTML version. Kept simple \u2014 no marketing layout, this is an internal email.
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin: 0 0 4px;">New support ticket</h2>
      <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">Ticket ID: ${escape(args.ticketId)}</p>

      <table style="border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">From</td><td style="padding: 4px 0;">${escape(args.userName ?? '(no name)')} &lt;${escape(args.userEmail ?? 'unknown')}&gt;</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Company</td><td style="padding: 4px 0;">${escape(args.companyName ?? '(no company)')}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Category</td><td style="padding: 4px 0;">${escape(args.category)}</td></tr>
        ${args.pageContext ? `<tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Page</td><td style="padding: 4px 0;">${escape(args.pageContext)}</td></tr>` : ''}
        <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Submitted</td><td style="padding: 4px 0;">${escape(args.createdAt)}</td></tr>
      </table>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px;">
        <p style="margin: 0 0 4px; font-weight: 600;">${escape(args.subject)}</p>
        <p style="margin: 0; color: #334155; white-space: pre-wrap;">${escape(args.body)}</p>
      </div>
    </div>
  `;

  const result = await sendEmail({
    to: SUPPORT_INBOX,
    replyTo: args.userEmail ?? undefined,
    subject,
    html,
    text,
    tags: [
      { name: 'kind', value: 'support_ticket' },
      { name: 'category', value: args.category },
    ],
  });

  // Update the ticket row with the outcome. Failures here are non-fatal \u2014
  // the user has their ticket; the admin tools can show "email never sent"
  // if we ever need to chase it manually.
  try {
    const supabase = await createSupabaseServerClient();
    if (result.ok) {
      await supabase
        .from('support_tickets')
        .update({ email_forwarded_at: new Date().toISOString() })
        .eq('id', args.ticketId);
    } else {
      await supabase
        .from('support_tickets')
        .update({ email_forward_error: result.error.slice(0, 500) })
        .eq('id', args.ticketId);
    }
  } catch (err) {
    console.warn('[support] could not record forward outcome:', err);
  }
}

/**
 * Returns the calling user's tickets (newest first).
 */
export async function listMySupportTickets(): Promise<TicketSummary[]> {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, priority, created_at, updated_at, messages')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[support] list failed:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    created_at: row.created_at,
    updated_at: row.updated_at,
    message_count: Array.isArray(row.messages) ? row.messages.length : 0,
  }));
}
