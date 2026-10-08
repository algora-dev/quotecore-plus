'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { verifyMessageReplyToken } from '@/app/lib/messages/replyToken';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export interface SubmitMessageReplyInput {
  token: string;
  action: 'accept' | 'decline' | 'request_changes' | 'question';
  body: string | null;
}

export type SubmitMessageReplyResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Public server action that records a recipient's structured reply, marks
 * the message replied, and fires a company-wide in-app alert.
 *
 * Trust model: the only access gate is the HMAC-signed reply token. We
 * never trust the caller's auth (they are anonymous by design) and we run
 * via the service-role client because we're writing into RLS-protected
 * tables that the recipient has no row-level access to.
 *
 * Idempotency: if the message is already replied (`replied_at` set), we
 * still insert another reply row \u2014 the sender's intent is to allow
 * follow-ups \u2014 but we only fire ONE alert (the first reply). Subsequent
 * replies show up in the Sent Messages tab as additional rows under the
 * same parent message.
 *
 * Rate limit: 10 submissions per token per hour. A token is per-recipient
 * so this is the right grain; it stops a bored recipient from
 * flooding the alert stream.
 */
export async function submitMessageReply(
  input: SubmitMessageReplyInput,
): Promise<SubmitMessageReplyResult> {
  // Token validation.
  const payload = verifyMessageReplyToken(input.token);
  if (!payload) {
    return { ok: false, error: 'This link is no longer valid.' };
  }

  // Rate limit by token id.
  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  const allowedToken = await checkRateLimit(`message-reply-token:${payload.mid}`, 10, 60 * 60 * 1000, { failClosed: true });
  if (!allowedToken) {
    return { ok: false, error: 'Too many responses. Please wait a moment and try again.' };
  }

  // Defensive shape checks.
  const ACTION_VALUES = ['accept', 'decline', 'request_changes', 'question'] as const;
  if (!ACTION_VALUES.includes(input.action)) {
    return { ok: false, error: 'Invalid response option.' };
  }
  if (input.body !== null && (input.body.length < 1 || input.body.length > 8000)) {
    return { ok: false, error: 'Message must be between 1 and 8000 characters.' };
  }

  const supabase = createAdminClient();

  // Load the message so we have company_id + check the recipient matches.
  const { data: message, error: loadErr } = await supabase
    .from('outbound_messages')
    .select(
      'id, company_id, recipient_email, recipient_name, replied_at, related_quote_id, related_order_id, kind, subject',
    )
    .eq('id', payload.mid)
    .maybeSingle();

  if (loadErr || !message) {
    return { ok: false, error: 'This message no longer exists.' };
  }
  if (message.recipient_email !== payload.to) {
    return { ok: false, error: 'This link is no longer valid.' };
  }

  // Insert the reply row.
  const { error: replyErr } = await supabase.from('outbound_message_replies').insert({
    message_id: message.id,
    company_id: message.company_id,
    action: input.action,
    body: input.body,
    ip,
    user_agent: hdrs.get('user-agent'),
  });
  if (replyErr) {
    return { ok: false, error: 'Could not record your response. Please try again.' };
  }

  const isFirstReply = !message.replied_at;
  if (isFirstReply) {
    // Mark the message replied. We accept a race: two concurrent first
    // replies (rare) would both flip this, with the second update being
    // a no-op.
    await supabase
      .from('outbound_messages')
      .update({ replied_at: new Date().toISOString() })
      .eq('id', message.id);

    // Fire the in-app alert for the sending company.
    const senderLabel = message.recipient_name || message.recipient_email;
    const actionLabels: Record<typeof input.action, string> = {
      accept: 'Accepted',
      decline: 'Declined',
      request_changes: 'Requested changes',
      question: 'Asked a question',
    };
    const alertTitle = `${actionLabels[input.action]} \u2013 ${senderLabel}`;
    const alertBody = input.body
      ? `Re: ${message.subject}\n\n${input.body.slice(0, 280)}${input.body.length > 280 ? '\u2026' : ''}`
      : `Re: ${message.subject}`;

    await supabase.from('alerts').insert({
      company_id: message.company_id,
      quote_id: message.related_quote_id,
      alert_type: 'message_reply',
      title: alertTitle,
      message: alertBody,
    });
  }

  return { ok: true };
}

/**
 * Public server action that adds the recipient to the per-company
 * suppression list. Linked from the email footer ("Stop emailing me").
 * Idempotent: re-clicking is a no-op.
 */
export async function suppressMessageRecipient(
  token: string,
): Promise<SubmitMessageReplyResult> {
  const payload = verifyMessageReplyToken(token);
  if (!payload) {
    return { ok: false, error: 'This link is no longer valid.' };
  }

  const supabase = createAdminClient();
  const { data: message } = await supabase
    .from('outbound_messages')
    .select('id, company_id, recipient_email')
    .eq('id', payload.mid)
    .maybeSingle();
  if (!message || message.recipient_email !== payload.to) {
    return { ok: false, error: 'This link is no longer valid.' };
  }

  await supabase.from('message_suppressions').upsert(
    {
      company_id: message.company_id,
      email: message.recipient_email,
      reason: 'Recipient clicked Stop emailing me',
      source_message_id: message.id,
    },
    { onConflict: 'company_id,email' },
  );

  return { ok: true };
}

/**
 * Form-action variant of suppressMessageRecipient. Used by the
 * confirmation form on /m/<token>/stop so that the actual write only
 * happens on POST.
 *
 * Why this matters: email clients (Gmail, Outlook), link safety
 * scanners, image proxies, hover-preview generators, and chat-app
 * unfurl bots routinely fetch URLs found in emails with plain GET
 * requests. If a GET to /m/<token>/stop performed the write, a single
 * pre-fetch by Gmail's link scanner was enough to re-suppress a
 * recipient who had just been removed from the admin list. This
 * function is wired to a real <form> submit, so a GET never triggers it.
 *
 * On success we redirect to ?confirmed=1 so the page can render the
 * success state without exposing the action's return value. On failure
 * we redirect with the error message in the query string.
 */
export async function confirmSuppressionFromForm(formData: FormData): Promise<never> {
  const token = formData.get('token');
  const tokenStr = typeof token === 'string' ? token : '';

  if (!tokenStr) {
    redirect(`/m/invalid/stop?error=${encodeURIComponent('Missing token.')}`);
  }

  const result = await suppressMessageRecipient(tokenStr);
  if (!result.ok) {
    redirect(
      `/m/${encodeURIComponent(tokenStr)}/stop?error=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/m/${encodeURIComponent(tokenStr)}/stop?confirmed=1`);
}
