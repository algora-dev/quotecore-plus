/**
 * Shared base layout for all transactional emails.
 *
 * Why a string template instead of React Email: the dependency surface stays
 * tiny, the markup is well-tested, and we render server-side once per email
 * with no client overhead. If the design ever needs richer composition we can
 * port to React Email behind this same API.
 *
 * Style rules followed (battle-tested for Outlook + Gmail + Apple Mail):
 *  - All CSS is inline; <style> blocks are stripped or sandboxed in many clients.
 *  - Layout uses <table> elements; flex/grid is unreliable.
 *  - Width capped at 560px (mobile-safe).
 *  - Fallback link printed below every CTA in case the button is stripped.
 */

export type EmailLayoutInput = {
  /** Logical heading shown as the H1 inside the card. */
  heading: string;
  /** Pre-rendered inner HTML (may contain <p>, <table>, etc.). */
  innerHtml: string;
  /**
   * Optional preview text (preheader) - first ~100 chars shown in the inbox
   * preview line on most clients. Hidden visually inside the email.
   */
  preheader?: string;
};

const LOGO_URL = 'https://quotecore-plus-main.vercel.app/logo-email.png';

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export function renderEmailLayout({ heading, innerHtml, preheader }: EmailLayoutInput): string {
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F9FAFB;opacity:0;">${escapeHtml(preheader)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0A0A0A;-webkit-font-smoothing:antialiased;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid #F3F4F6;">
<img src="${LOGO_URL}" alt="QuoteCore+" width="160" style="display:block;border:0;height:auto;max-width:160px;" />
</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 16px 0;font-size:22px;line-height:28px;font-weight:600;color:#0A0A0A;">${escapeHtml(heading)}</h1>
${innerHtml}
</td></tr>
<tr><td style="padding:24px 32px;background-color:#F9FAFB;border-top:1px solid #F3F4F6;">
<p style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#6B7280;">QuoteCore<span style="color:#F97316;">+</span> &mdash; Quoting &amp; job management for trades</p>
<p style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#9CA3AF;">Sent via QuoteCore+ &bull; <a href="mailto:info@quote-core.com" style="color:#9CA3AF;text-decoration:underline;">info@quote-core.com</a></p>
<p style="margin:0;font-size:11px;line-height:16px;color:#9CA3AF;font-style:italic;">This is an automated message &mdash; please don't reply to this email.</p>
</td></tr></table></td></tr></table></body></html>`;
}

/** Build a primary CTA button + fallback link block. */
export function ctaBlock(label: string, url: string, fallbackText = "If the button doesn't work, copy and paste this link into your browser:"): string {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F97316;border-radius:8px;">
<a href="${safeUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">${safeLabel}</a>
</td></tr></table>
<p style="margin:28px 0 0 0;font-size:13px;line-height:20px;color:#6B7280;">${escapeHtml(fallbackText)}</p>
<p style="margin:8px 0 0 0;font-size:13px;line-height:20px;color:#6B7280;word-break:break-all;"><a href="${safeUrl}" style="color:#F97316;text-decoration:none;">${safeUrl}</a></p>`;
}

/** A simple paragraph helper. Escapes by default; pass safe HTML via `html` arg. */
export function para(text: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">${escapeHtml(text)}</p>`;
}
export function paraHtml(html: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">${html}</p>`;
}
export function note(text: string): string {
  return `<p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:#9CA3AF;">${escapeHtml(text)}</p>`;
}

/** A keyed-info block (label : value pairs) - used by security emails. */
export function infoTable(rows: { label: string; value: string }[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border-collapse:collapse;">
${rows
  .map(
    (r) => `<tr>
<td style="padding:6px 16px 6px 0;font-size:13px;line-height:20px;color:#6B7280;">${escapeHtml(r.label)}</td>
<td style="padding:6px 0;font-size:13px;line-height:20px;color:#0A0A0A;">${escapeHtml(r.value)}</td>
</tr>`
  )
  .join('\n')}
</table>`;
}

export { escapeHtml };
