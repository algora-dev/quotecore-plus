/**
 * Outbound Messages pipeline - single entry point.
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
import { resolveOutboundAttachments } from './attachmentResolver';

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
   * Override the primary CTA button in the email shell. If null/omitted
   * the pipeline picks a default based on `kind`:
   *   quote_send / followup  → "View quote" → /accept/<acceptanceToken>
   *   order_send             → "View order" → /orders/<acceptanceToken>
   *   decline_response       → "Reply"     → /m/<replyToken>
   *   custom                 → "Respond now" → /m/<replyToken>
   *
   * Callers (sendQuoteMessage / sendOrderMessage) usually pass null and
   * let the pipeline decide. They only override when there's no
   * acceptance token available (e.g. quote without a customer quote)
   * and we want to fall back to the generic reply page.
   */
  primaryCta?: {
    label: string;
    /** Either an absolute URL or a path relative to the site URL. */
    url: string;
  } | null;
  /**
   * Public acceptance/order token for the related quote or order, if
   * one already exists. When the pipeline picks the default primary
   * CTA per `kind`, it uses this to build the URL. If not supplied,
   * the pipeline falls back to the generic /m/<replyToken> page.
   */
  acceptanceToken?: string | null;
  /**
   * Files to attach to this send (Option B - hosted + token-gated, NOT MIME).
   * IDS ONLY, never raw storage paths (Gerald H-03 #1). The resolver verifies
   * ownership, drops anything unauthorised, snapshots display names, and
   * records `message_attachments` rows the hosted pages + download route read.
   */
  attachmentSelection?: {
    libraryAttachmentIds?: string[];
    quoteFileIds?: string[];
  };
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
 * Resolve a possibly-relative URL to an absolute one against the site
 * base URL. Centralised so the per-kind default and caller-supplied
 * overrides both produce the same shape.
 */
function resolveUrl(siteUrl: string, candidate: string): string {
  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    return candidate;
  }
  return `${siteUrl}${candidate.startsWith('/') ? '' : '/'}${candidate}`;
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
 * Returns `{ ok: true }` for both sent and suppressed messages - both are
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

  // Decide the primary CTA.
  //
  // Precedence:
  //   1. Caller-supplied `input.primaryCta` override.
  //   2. Per-kind default using `input.acceptanceToken` to point at the
  //      richer customer/supplier page when available.
  //   3. Fall back to the generic /m/<replyToken> page.
  //
  // Why default in the pipeline instead of the call sites: there's one
  // sensible default per `kind` and centralising it means a future kind
  // (e.g. invoice_send) only has to add one switch arm here rather than
  // forcing every caller to re-derive the right URL.
  const primaryCta = (() => {
    if (input.primaryCta) {
      return {
        label: input.primaryCta.label,
        url: resolveUrl(siteUrl, input.primaryCta.url),
      };
    }
    const tok = input.acceptanceToken;
    if (tok) {
      switch (input.kind) {
        case 'quote_send':
        case 'followup':
          return { label: 'View quote', url: `${siteUrl}/accept/${encodeURIComponent(tok)}` };
        case 'order_send':
          return { label: 'View order', url: `${siteUrl}/orders/${encodeURIComponent(tok)}` };
        // decline_response + custom drop through to the reply-page default.
        default:
          break;
      }
    }
    if (input.kind === 'decline_response') {
      return { label: 'Reply', url: messageReplyUrl };
    }
    return { label: 'Respond now', url: messageReplyUrl };
  })();

  // The body / subject can also reference {{quote_link}} or {{order_link}};
  // populate those from whichever per-kind URL the CTA resolved to so
  // text references in templates match the button URL.
  const linkContext: MergeVarContext = {};
  if (input.acceptanceToken) {
    if (input.kind === 'quote_send' || input.kind === 'followup' || input.kind === 'decline_response') {
      linkContext.quote_link = `${siteUrl}/accept/${encodeURIComponent(input.acceptanceToken)}`;
    }
    if (input.kind === 'order_send') {
      linkContext.order_link = `${siteUrl}/orders/${encodeURIComponent(input.acceptanceToken)}`;
    }
  }
  // Resolve + persist any selected attachments (Option B hosted delivery).
  // Server-side ownership checks live in the resolver; unauthorised ids are
  // silently dropped. We await fully (Vercel serverless - no fire-and-forget)
  // so the message_attachments rows exist before the email links to them.
  let attachmentCount = 0;
  let standaloneAttachmentToken: string | null = null;
  if (input.attachmentSelection) {
    const resolved = await resolveOutboundAttachments({
      companyId: input.companyId,
      quoteId: input.relatedQuoteId ?? null,
      orderId: input.relatedOrderId ?? null,
      libraryAttachmentIds: input.attachmentSelection.libraryAttachmentIds,
      quoteFileIds: input.attachmentSelection.quoteFileIds,
    });
    attachmentCount = resolved.length;
    // Standalone sends (no quote/order) carry a per-attachment access token.
    // We surface the first one as the {{attachment_link}} / fallback CTA so
    // the recipient has a single "Download file" destination. (Multi-file
    // standalone sends still each get their own row + token for the file
    // page; the link points at the first, which lists/serves that file.)
    const standalone = resolved.find((r) => r.accessToken);
    if (standalone?.accessToken) {
      standaloneAttachmentToken = standalone.accessToken;
    }
  }

  // Build the hosted attachment link, if any. For quote/order sends the
  // attachments live on the accept/order page (already the primary CTA), so
  // {{attachment_link}} simply points there. For standalone sends it points
  // at the dedicated /file/<token> page.
  if (attachmentCount > 0) {
    if (standaloneAttachmentToken) {
      linkContext.attachment_link = `${siteUrl}/file/${encodeURIComponent(standaloneAttachmentToken)}`;
    } else if (input.acceptanceToken) {
      if (input.kind === 'order_send') {
        linkContext.attachment_link = `${siteUrl}/orders/${encodeURIComponent(input.acceptanceToken)}`;
      } else {
        linkContext.attachment_link = `${siteUrl}/accept/${encodeURIComponent(input.acceptanceToken)}`;
      }
    }
  }

  const bodyWithLinks = renderMergeVars(bodyWithReplyLink, linkContext);
  const subjectWithLinks = renderMergeVars(subjectWithReplyLink, linkContext);

  // For a standalone attachment send (no quote/order CTA), repoint the
  // primary button at the file page so the recipient has a clear download
  // destination instead of the generic reply page.
  const effectiveCta =
    standaloneAttachmentToken && !input.primaryCta && !input.acceptanceToken
      ? { label: 'Download file', url: linkContext.attachment_link as string }
      : primaryCta;

  const html = renderOutboundMessageHtml({
    companyName: input.companyName,
    companyLogoUrl: input.companyLogoUrl ?? null,
    companyEmail: input.companyEmail ?? null,
    companyPhone: input.companyPhone ?? null,
    bodyText: bodyWithLinks,
    replyUrl: effectiveCta.url,
    replyCtaLabel: effectiveCta.label,
    unsubscribeUrl,
  });
  const text = renderOutboundMessageText({
    companyName: input.companyName,
    bodyText: bodyWithLinks,
    replyUrl: effectiveCta.url,
    replyCtaLabel: effectiveCta.label,
    unsubscribeUrl,
    companyEmail: input.companyEmail ?? null,
    companyPhone: input.companyPhone ?? null,
  });

  // Persist the final rendered subject/body so the outbound_messages row
  // captures exactly what the recipient received (including the link
  // substitution that happened post-insert).
  await supabase
    .from('outbound_messages')
    .update({ subject: subjectWithLinks, body: bodyWithLinks })
    .eq('id', messageId);

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
    subject: subjectWithLinks,
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
