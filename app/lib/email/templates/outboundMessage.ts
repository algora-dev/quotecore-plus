/**
 * Branded outbound-message email template.
 *
 * Used by the Messages pipeline (`app/lib/messages/send.ts`) for every
 * user-initiated send: quote-send, order-send, follow-up, decline-response,
 * and freeform custom messages.
 *
 * Design contract (Shaun, 2026-05-12):
 *  - The PERCEIVED sender is the user's company. Their logo (if uploaded)
 *    sits at the top, their name renders in the From-line preview text, and
 *    the body is the message they wrote.
 *  - The TECHNICAL sender is QuoteCore+'s domain. The header still shows
 *    "Sent via QuoteCore+" small print so the recipient can verify the
 *    pipeline if they want to.
 *  - Replies happen via a CTA button to the in-app reply page. Hitting
 *    Reply in the email client bounces (no-reply address).
 *  - A small "stop emailing me" link in the footer writes a per-company
 *    suppression so future sends from THIS company to THIS recipient are
 *    blocked. Required by anti-spam law for non-transactional mail.
 */

import { escapeHtml, paraHtml } from '../baseLayout';

/**
 * Button-only CTA. Unlike the shared `ctaBlock` helper used by
 * security/alert emails, outbound Messages omit the fallback
 * "If the button doesn't work, copy and paste this URL" line because
 * Shaun spec'd a single, prominent action button (2026-05-12) and the
 * extra text reads like clutter in a customer-facing message.
 */
function primaryCtaButton(label: string, url: string): string {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F97316;border-radius:8px;">
<a href="${safeUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">${safeLabel}</a>
</td></tr></table>`;
}

const SITE_FOOTER_TEXT = "Sent via QuoteCore+ \u2014 quoting & job management for trades.";

export interface OutboundMessageEmailInput {
  /** User's company name. Shown prominently in the header. */
  companyName: string;
  /** User's company logo URL, if uploaded. Falls back to no image. */
  companyLogoUrl?: string | null;
  /** User's contact email/phone shown in the body footer. */
  companyEmail?: string | null;
  companyPhone?: string | null;
  /** Pre-rendered message body (already merge-var substituted, plain text). */
  bodyText: string;
  /**
   * Full URL the primary CTA button points at. For quote_send / followup /
   * decline_response / custom this is the message reply page `/m/[token]`.
   * For order_send it's the supplier order page `/orders/[token]` so the
   * supplier lands on the full order rather than a generic reply form.
   */
  replyUrl: string;
  /** Label on the primary CTA button. Defaults to "Respond now". */
  replyCtaLabel?: string;
  /**
   * Full URL to the per-recipient suppression endpoint. Hitting it adds
   * the recipient to the sending company's `message_suppressions`. Path:
   * `/m/[token]/stop`.
   */
  unsubscribeUrl: string;
}

/**
 * Renders the full HTML for an outbound message. Returns `{ subject, html,
 * text }` so `sendEmail` can use both. The caller passes the subject
 * separately (already merge-var substituted at the call site) so this
 * template is responsible for body markup only.
 */
export function renderOutboundMessageHtml(input: OutboundMessageEmailInput): string {
  const logoHtml = input.companyLogoUrl
    ? `<img src="${escapeHtml(input.companyLogoUrl)}" alt="${escapeHtml(input.companyName)}" style="display:block;max-width:160px;max-height:64px;border:0;height:auto;margin-bottom:8px;" />`
    : '';

  const contactBits: string[] = [];
  if (input.companyEmail) {
    contactBits.push(
      `<a href="mailto:${escapeHtml(input.companyEmail)}" style="color:#6B7280;text-decoration:none;">${escapeHtml(input.companyEmail)}</a>`,
    );
  }
  if (input.companyPhone) contactBits.push(escapeHtml(input.companyPhone));
  const contactLine = contactBits.length
    ? `<p style="margin:16px 0 0 0;font-size:13px;line-height:20px;color:#6B7280;">${contactBits.join(' &bull; ')}</p>`
    : '';

  // Convert the bodyText (plain text written by the user) into paragraphs.
  // Two-or-more newlines = paragraph break; single newlines become <br/>.
  const paragraphs = input.bodyText
    .split(/\n{2,}/)
    .map((p) =>
      paraHtml(escapeHtml(p).replace(/\n/g, '<br/>')),
    )
    .join('\n');

  const cta = primaryCtaButton(input.replyCtaLabel ?? 'Respond now', input.replyUrl);

  // Inline the per-message branded layout. We do NOT use the shared
  // renderEmailLayout() here because the company-branded header is
  // different from the QuoteCore+ header used by alerts/security mail.
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(input.companyName)}</title></head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0A0A0A;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px 32px;border-bottom:1px solid #F3F4F6;">
${logoHtml}
<p style="margin:0;font-size:18px;line-height:24px;font-weight:600;color:#0A0A0A;">${escapeHtml(input.companyName)}</p>
<p style="margin:4px 0 0 0;font-size:12px;line-height:18px;color:#9CA3AF;">${SITE_FOOTER_TEXT}</p>
</td></tr>
<tr><td style="padding:32px;">
${paragraphs}
<div style="margin:28px 0 0 0;">${cta}</div>
${contactLine}
</td></tr>
<tr><td style="padding:20px 32px;background-color:#F9FAFB;border-top:1px solid #F3F4F6;">
<p style="margin:0 0 6px 0;font-size:11px;line-height:16px;color:#9CA3AF;">This email was sent to you from ${escapeHtml(input.companyName)} via QuoteCore<span style="color:#F97316;">+</span>.</p>
<p style="margin:0;font-size:11px;line-height:16px;color:#9CA3AF;">Replies to this email address bounce. Please use the &ldquo;Respond now&rdquo; button above. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#9CA3AF;text-decoration:underline;">Stop emailing me</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
}

/** Plain-text fallback for accessibility / spam-filter friendliness. */
export function renderOutboundMessageText(input: OutboundMessageEmailInput): string {
  const lines = [
    input.companyName,
    SITE_FOOTER_TEXT,
    '',
    input.bodyText,
    '',
    `Respond: ${input.replyUrl}`,
  ];
  if (input.companyEmail || input.companyPhone) {
    const contact = [input.companyEmail, input.companyPhone].filter(Boolean).join(' | ');
    lines.push('', contact);
  }
  lines.push(
    '',
    '---',
    `This email was sent to you from ${input.companyName} via QuoteCore+.`,
    'Replies to this email address bounce. Please use the link above.',
    `Stop emailing me: ${input.unsubscribeUrl}`,
  );
  return lines.join('\n');
}
