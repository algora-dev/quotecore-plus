/**
 * Ad-hoc promotional email template.
 *
 * Reusable, campaign-agnostic email for one-off sends (discounts, offers,
 * announcements). Nothing campaign-specific is hardcoded - every field is
 * supplied at call time. Reuses the shared QuoteCore+ base layout
 * (`renderEmailLayout`) so branding stays consistent with transactional mail.
 *
 * For marketing / promotional content an unsubscribe link is rendered in the
 * footer (required by CAN-SPAM / GDPR for non-transactional mail). Pass
 * `unsubscribeUrl` to include it.
 *
 * Includes an optional discount "offer panel" (amount / code / duration) and
 * an optional secondary link below the primary CTA.
 */

import 'server-only';
import {
  renderEmailLayout,
  ctaBlock,
  para,
  paraHtml,
  note,
  escapeHtml,
} from '../baseLayout';

export type AdhocEmailInput = {
  /** Recipient's first name (rendered in the greeting). */
  firstName: string;
  /** Subject line. */
  subject: string;
  /** Logical H1 shown inside the email card. */
  heading: string;
  /**
   * Body copy. Either plain text (auto-paragraphed) via `body`, or fully
   * pre-rendered safe HTML via `bodyHtml`. Supply exactly one.
   */
  body?: string;
  bodyHtml?: string;
  /** Primary CTA. */
  ctaLabel: string;
  ctaUrl: string;
  /** Optional secondary link/button shown under the primary CTA. */
  secondaryLabel?: string;
  secondaryUrl?: string;
  /** Optional discount panel. */
  discount?: {
    /** e.g. "20%", "$15/mo" */
    amount: string;
    /** e.g. "WELCOME20" (omit if no code) */
    code?: string;
    /** e.g. "for the first 3 months" */
    duration?: string;
  };
  /** Greeting lines before the body (plain strings become paragraphs). */
  intro?: string[];
  /** Closing line, e.g. "The QuoteCore+ team". */
  closing?: string;
  /**
   * Unsubscribe URL. REQUIRED for marketing/promotional sends. When present,
   * renders a small "unsubscribe" link in the footer.
   */
  unsubscribeUrl?: string;
};

function renderBody(input: AdhocEmailInput): string {
  if (input.bodyHtml) return input.bodyHtml;
  if (input.body) {
    return input.body
      .split(/\n{2,}/)
      .map((p) => para(p))
      .join('\n');
  }
  return '';
}

function renderDiscount(input: AdhocEmailInput): string {
  if (!input.discount) return '';
  const d = input.discount;
  const codeHtml = d.code
    ? `<tr><td style="padding:8px 0 4px 0;font-size:12px;line-height:18px;color:#6B7280;">Use code</td></tr>
<tr><td style="padding:0 0 4px 0;"><span style="font-size:20px;font-weight:700;color:#0A0A0A;letter-spacing:1px;">${escapeHtml(d.code)}</span></td></tr>`
    : '';
  const durationHtml = d.duration
    ? `<tr><td style="padding:4px 0 0 0;font-size:13px;line-height:20px;color:#374151;">${escapeHtml(d.duration)}</td></tr>`
    : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;width:100%;"><tr><td style="padding:24px;background-color:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="font-size:13px;line-height:18px;color:#9A3412;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your offer</td></tr>
<tr><td style="padding:8px 0 0 0;font-size:30px;line-height:34px;font-weight:700;color:#0A0A0A;">${escapeHtml(d.amount)}</td></tr>
${codeHtml}
${durationHtml}
</table>
</td></tr></table>`;
}

function renderIntro(intro?: string[]): string {
  if (!intro || intro.length === 0) return '';
  return intro.map((line) => para(line)).join('\n');
}

/** Render the branded ad-hoc email. Returns { subject, html, text }. */
export function renderAdhocEmail(input: AdhocEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = input.firstName.trim() || 'there';
  const greeting = `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">Hi ${escapeHtml(firstName)},</p>`;

  const innerHtml = [
    greeting,
    renderIntro(input.intro),
    renderBody(input),
    renderDiscount(input),
    `${ctaBlock(input.ctaLabel, input.ctaUrl)}`,
    input.secondaryLabel && input.secondaryUrl
      ? `<p style="margin:20px 0 0 0;font-size:14px;line-height:20px;"><a href="${escapeHtml(input.secondaryUrl)}" style="color:#F97316;text-decoration:none;font-weight:600;">${escapeHtml(input.secondaryLabel)}</a></p>`
      : '',
    input.closing ? `<p style="margin:28px 0 0 0;font-size:15px;line-height:24px;color:#374151;">${escapeHtml(input.closing)}</p>` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Footer unsubscribe line for marketing sends.
  const unsubscribeHtml = input.unsubscribeUrl
    ? `<p style="margin:12px 0 0 0;font-size:12px;line-height:18px;color:#9CA3AF;">You're receiving this because you opted in to updates from QuoteCore+. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe</a></p>`
    : '';

  const html = renderEmailLayout({
    heading: input.heading,
    innerHtml,
    preheader: input.heading,
  });

  const textLines: string[] = [];
  textLines.push(`Hi ${firstName},`);
  if (input.intro) textLines.push(...input.intro);
  if (input.body) textLines.push(input.body);
  if (input.discount) {
    textLines.push(`\nYour offer: ${input.discount.amount}`);
    if (input.discount.code) textLines.push(`Use code: ${input.discount.code}`);
    if (input.discount.duration) textLines.push(input.discount.duration);
  }
  textLines.push(`\n${input.ctaLabel}: ${input.ctaUrl}`);
  if (input.secondaryLabel && input.secondaryUrl) {
    textLines.push(`${input.secondaryLabel}: ${input.secondaryUrl}`);
  }
  if (input.closing) textLines.push(`\n${input.closing}`);
  if (input.unsubscribeUrl) textLines.push(`\nUnsubscribe: ${input.unsubscribeUrl}`);
  const text = textLines.filter(Boolean).join('\n\n');

  return { subject: input.subject, html, text };
}
