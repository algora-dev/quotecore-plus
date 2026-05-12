/**
 * Outbound Messages pipeline — single entry point.
 *
 * Every outbound user-initiated message (quote send, order send, follow-up,
 * decline response, freeform custom) goes through `sendOutboundMessage`.
 * The pipeline:
 *
 *   1. Validates inputs and resolves the sending user's company context.
 *   2. Renders subject + body via merge-variables (the caller passes the
 *      raw template + a context object).
 *   3. Checks the recipient against the per-company suppression list. If
 *      suppressed, inserts an `outbound_messages` row with
 *      `status='suppressed'` and returns without dispatching.
 *   4. Issues an HMAC-signed reply token (90-day expiry).
 *   5. Inserts the `outbound_messages` row with `status='queued'` so the
 *      record exists even if the Resend call fails.
 *   6. Renders the branded HTML/text and dispatches via Resend.
 *   7. Updates the row to `status='sent'` (or `'failed'` with the error).
 *
 * The caller (server action on a quote summary, etc.) gets back an opaque
 * result they can show in the UI. The outbound_messages row is the audit
 * trail; we don't expose Resend message ids to the caller.
 *
 * Why a dedicated module rather than reusing `app/lib/email/notify.ts`:
 * notify.ts is for QuoteCore+ -> user emails (alerts, security). This is
 * user-company -> their customer, which needs a different branded
 * template, a reply-token, and a write-through to outbound_messages. The
 * surface area is genuinely different.
 */

import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { sendEmail } from '@/app/lib/email/send';
import {
  renderOutboundMessageHtml,
  renderOutboundMessageText,
} from '@/app/lib/email/templates/outboundMessage';
import { getSiteUrl } from '@/app/lib/email/urls';
import { signHmacToken, randomNonce } from '@/app/lib/security/hmacToken';
import { renderMergeVars, type MergeVarContext } from './mergeVars';

const MESSAGE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days.
const MESSAGE_TOKEN_SECRET_ENV = 'MESSAGES_SIGNING_SECRET';

export type OutboundMessageKind =
  | 'quote_send'
  | 'order_send'
  | 'followup'
  | 'decline_response'
  | 'custom';

export interface SendOutboundMessageInput {
  companyId: string;
  senderUserId: string;
  kind: OutboundMessageKind;
  /** The quote / order this message relates to. At most one of these. */
  relatedQuoteId?: string | null;
  relatedOrderId?: string | null;
  /** Template the user chose, if any. Recorded for audit; not required. */
  templateId?: string | null;
  /** RAW subject (may contain merge vars). */
  subject: string;
  /** RAW body (may contain merge vars). Plain text; the email template
   * wraps it in branded HTML. */
  body: string;
  recipientEmail: string;
  recipientName?: string | null;
  /** Context for `{{...}}` substitution in subject and body. */
  mergeContext: MergeVarContext;
  /** User's company branding for the email shell. */
  companyName: string;
  companyLogoUrl?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  /**
   * Override the primary CTA button in the email shell. Default is to
   * point at `/m/[token]` (the generic reply page) with label
   * "Respond now". order_send sends pass an override here so the
   * supplier lands directly on the order page.
   */
  primaryCta?: {
    label: string;
    /** Either an absolute URL or a path relative to the site URL. */
    url: string;
  } | null;
}

export type SendOutboundMessageResult =
  | { ok: true; messageId: string; status: 'sent' | 'suppressed' }
  | { ok: false; messageId: string | null; error: string };

interface MessageTokenPayload {
  /** Message row id. */
  mid: string;
  /** Recipient lowercased email so the reply page can confirm we're showing
   *  the right address back to the recipient. */
  to: string;
  exp: number;
  nonce: string;
}

function lowerEmail(e: string): string {
  return e.trim().toLowerCase();
}

/**
 * Strip characters that would break the `From:` header (especially the
 * angle brackets and the comma which RFC 2822 treats as an address
 * separator). We keep readable ASCII + common Latin-1 punctuation and
 * trim aggressively; if the result is empty after sanitisation we fall
 * back to a generic name so the header never ends up malformed.
 */
function sanitiseFromDisplay(name: string): string {
  const cleaned = name
    .replace(/[<>"\\,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
  return cleaned || 'QuoteCore+ user';
}

/**
 * Issue a reply token for a given message id + recipient. Token is
 * verified by the reply page via `verifyMessageReplyToken`.
 */
export function issueMessageReplyToken(messageId: string, recipientEmail: string): string {
  return signHmacToken<MessageTokenPayload>(
    {
      mid: messageId,
      to: lowerEmail(recipientEmail),
      exp: Date.now() + MESSAGE_TOKEN_TTL_MS,
      nonce: randomNonce(),
    },
    MESSAGE_TOKEN_SECRET_ENV,
  );
}

/**
 * Verify a reply token. Returns the payload or null on any failure.
 * Re-exports `verifyHmacToken` typed to the message payload so the reply
 * page doesn't need to know the generic shape.
 */
export { MESSAGE_TOKEN_SECRET_ENV };
export type { MessageTokenPayload };

/**
 * The pipeline entry point.
 *
 * Returns `{ ok: true }` for both sent and suppressed messages — both are
 * "the user's intent was honoured" outcomes. Truly failed sends (e.g.
 * Resend down) return `{ ok: false, error }` AND leave the
 * outbound_messages row at `status='failed'` so the user can retry.
 */
export async function sendOutboundMessage(
  input: SendOutboundMessageInput,
): Promise<SendOutboundMessageResult> {
  // Defensive validation. Schemas at the action layer should already have
  // caught most of these; we re-check so library callers can't accidentally
  // bypass the rules.
  if (!input.companyId) return { ok: false, messageId: null, error: 'companyId required' };
  if (!input.senderUserId) return { ok: false, messageId: null, error: 'senderUserId required' };
  if (!input.recipientEmail) return { ok: false, messageId: null, error: 'recipientEmail required' };
  if (input.relatedQuoteId && input.relatedOrderId) {
    return { ok: false, messageId: null, error: 'relatedQuoteId and relatedOrderId are mutually exclusive' };
  }

  const supabase = createAdminClient();
  const recipientLower = lowerEmail(input.recipientEmail);

  // 1. Check suppression list before doing any work.
  const { data: suppression } = await supabase
    .from('message_suppressions')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('email', recipientLower)
    .maybeSingle();

  // 2. Render merge variables. Reply link populated AFTER we have the
  //    message id (chicken-and-egg). Subject/body get the rest now.
  const subjectRendered = renderMergeVars(input.subject, input.mergeContext);
  const bodyRendered = renderMergeVars(input.body, input.mergeContext);

  // 3. Insert the row first so we have an id to bind the reply token to.
  //    Use a placeholder reply_token; we update with the real one once
  //    we've signed using the inserted id.
  const placeholder = `pending-${crypto.randomUUID()}`;
  const { data: inserted, error: insertError } = await supabase
    .from('outbound_messages')
    .insert({
      company_id: input.companyId,
      sender_user_id: input.senderUserId,
      kind: input.kind,
      related_quote_id: input.relatedQuoteId ?? null,
      related_order_id: input.relatedOrderId ?? null,
      template_id: input.templateId ?? null,
      subject: subjectRendered,
      body: bodyRendered,
      recipient_email: recipientLower,
      recipient_name: input.recipientName ?? null,
      reply_token: placeholder,
      status: suppression ? 'suppressed' : 'queued',
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return { ok: false, messageId: null, error: insertError?.message ?? 'insert_failed' };
  }

  const messageId = inserted.id;

  // 4. Bail early if suppressed. The row is recorded so the UI can show
  //    "Blocked: recipient is on your suppression list".
  if (suppression) {
    return { ok: true, messageId, status: 'suppressed' };
  }

  // 5. Sign + persist the real reply token.
  const token = issueMessageReplyToken(messageId, recipientLower);
  await supabase
    .from('outbound_messages')
    .update({ reply_token: token })
    .eq('id', messageId);

  // 6. Build the URLs and the rendered email body.
  const siteUrl = getSiteUrl();
  const messageReplyUrl = `${siteUrl}/m/${encodeURIComponent(token)}`;
  const unsubscribeUrl = `${siteUrl}/m/${encodeURIComponent(token)}/stop`;

  // The body / subject may also reference {{reply_link}}; substitute again
  // now that we have the real URL.
  const bodyWithReplyLink = renderMergeVars(bodyRendered, { reply_link: messageReplyUrl });
  const subjectWithReplyLink = renderMergeVars(subjectRendered, { reply_link: messageReplyUrl });

  // Decide the primary CTA. Caller-supplied override wins; otherwise
  // default to the generic reply page. We resolve relative URLs against
  // the site URL so callers can pass e.g. `/orders/<token>` without
  // duplicating the host.
  const primaryCta = input.primaryCta
    ? {
        label: input.primaryCta.label,
        url: input.primaryCta.url.startsWith('http')
          ? input.primaryCta.url
          : `${siteUrl}${input.primaryCta.url.startsWith('/') ? '' : '/'}${input.primaryCta.url}`,
      }
    : { label: 'Respond now', url: messageReplyUrl };

  const html = renderOutboundMessageHtml({
    companyName: input.companyName,
    companyLogoUrl: input.companyLogoUrl ?? null,
    companyEmail: input.companyEmail ?? null,
    companyPhone: input.companyPhone ?? null,
    bodyText: bodyWithReplyLink,
    replyUrl: primaryCta.url,
    replyCtaLabel: primaryCta.label,
    unsubscribeUrl,
  });
  const text = renderOutboundMessageText({
    companyName: input.companyName,
    bodyText: bodyWithReplyLink,
    replyUrl: primaryCta.url,
    replyCtaLabel: primaryCta.label,
    unsubscribeUrl,
    companyEmail: input.companyEmail ?? null,
    companyPhone: input.companyPhone ?? null,
  });

  // 7. Dispatch. From-address display-name carries the user's company so
  //    the recipient sees "Acme Roofing via QuoteCore+" rather than
  //    QuoteCore+ alone. Reply-To is the no-reply address so direct
  //    replies bounce at the recipient's mail server (per Shaun spec
  //    2026-05-12). The technical sender stays on the verified
  //    quote-core.com domain so DKIM/DMARC pass.
  const safeDisplay = sanitiseFromDisplay(input.companyName);
  const fromHeader = `${safeDisplay} via QuoteCore+ <noreply@quote-core.com>`;
  const result = await sendEmail({
    from: fromHeader,
    to: input.recipientEmail,
    subject: subjectWithReplyLink,
    html,
    text,
    replyTo: 'noreply@quote-core.com',
    tags: [
      { name: 'kind', value: input.kind },
      { name: 'company', value: input.companyId },
    ],
  });

  if (!result.ok) {
    await supabase
      .from('outbound_messages')
      .update({ status: 'failed', send_error: result.error })
      .eq('id', messageId);
    return { ok: false, messageId, error: result.error };
  }

  await supabase
    .from('outbound_messages')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', messageId);

  return { ok: true, messageId, status: 'sent' };
}
