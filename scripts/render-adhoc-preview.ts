/**
 * Standalone preview renderer - runs OUTSIDE Next, so it must NOT import any
 * module guarded by `server-only`. Renders the ad-hoc email HTML directly by
 * re-implementing the layout call with the same branding, then prints it.
 * Never sends.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AdhocEmailInput } from '../app/lib/email/templates/adhoc';

const LOGO_URL = 'https://quotecore-plus-main.vercel.app/logo-email.png';
const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

function render(email: AdhocEmailInput): { subject: string; html: string; text: string } {
  const firstName = email.firstName.trim() || 'there';
  const bodyP = (email.body ?? '').split(/\n{2,}/).map(p => `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">${esc(p)}</p>`).join('\n');
  const introP = (email.intro ?? []).map(p => `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">${esc(p)}</p>`).join('\n');
  const discount = email.discount ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;width:100%;"><tr><td style="padding:24px;background-color:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:13px;line-height:18px;color:#9A3412;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your offer</td></tr><tr><td style="padding:8px 0 0 0;font-size:30px;line-height:34px;font-weight:700;color:#0A0A0A;">${esc(email.discount.amount)}</td></tr>${email.discount.code ? `<tr><td style="padding:8px 0 4px 0;font-size:12px;line-height:18px;color:#6B7280;">Use code</td></tr><tr><td style="padding:0 0 4px 0;"><span style="font-size:20px;font-weight:700;color:#0A0A0A;letter-spacing:1px;">${esc(email.discount.code)}</span></td></tr>` : ''}${email.discount.duration ? `<tr><td style="padding:4px 0 0 0;font-size:13px;line-height:20px;color:#374151;">${esc(email.discount.duration)}</td></tr>` : ''}</table></td></tr></table>` : '';
  const cta = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F97316;border-radius:8px;"><a href="${esc(email.ctaUrl)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">${esc(email.ctaLabel)}</a></td></tr></table>`;
  const secondary = email.secondaryLabel && email.secondaryUrl ? `<p style="margin:20px 0 0 0;font-size:14px;line-height:20px;"><a href="${esc(email.secondaryUrl)}" style="color:#F97316;text-decoration:none;font-weight:600;">${esc(email.secondaryLabel)}</a></p>` : '';
  const closing = email.closing ? `<p style="margin:28px 0 0 0;font-size:15px;line-height:24px;color:#374151;">${esc(email.closing)}</p>` : '';
  const unsub = email.unsubscribeUrl ? `<p style="margin:12px 0 0 0;font-size:12px;line-height:18px;color:#9CA3AF;">You're receiving this because you opted in to updates from QuoteCore+. <a href="${esc(email.unsubscribeUrl)}" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe</a></p>` : '';
  const inner = [`<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">Hi ${esc(firstName)},</p>`, introP, bodyP, discount, cta, secondary, closing, unsub].filter(Boolean).join('\n');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(email.heading)}</title></head><body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0A0A0A;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;"><tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid #F3F4F6;"><img src="${LOGO_URL}" alt="QuoteCore+" width="160" style="display:block;border:0;height:auto;max-width:160px;"/></td></tr><tr><td style="padding:32px;"><h1 style="margin:0 0 16px 0;font-size:22px;line-height:28px;font-weight:600;color:#0A0A0A;">${esc(email.heading)}</h1>${inner}</td></tr><tr><td style="padding:24px 32px;background-color:#F9FAFB;border-top:1px solid #F3F4F6;"><p style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#6B7280;">QuoteCore<span style="color:#F97316;">+</span> &mdash; Quoting &amp; job management for trades</p><p style="margin:0;font-size:11px;line-height:16px;color:#9CA3AF;">Sent via QuoteCore+ &bull; <a href="mailto:info@quote-core.com" style="color:#9CA3AF;text-decoration:underline;">info@quote-core.com</a></p></td></tr></table></td></tr></table></body></html>`;
  const text = [`Hi ${firstName},`, ...(email.intro ?? []), email.body ?? '', email.discount ? `Your offer: ${email.discount.amount}${email.discount.code ? ` (code ${email.discount.code})` : ''}${email.discount.duration ? ` ${email.discount.duration}` : ''}` : '', `${email.ctaLabel}: ${email.ctaUrl}`, email.secondaryLabel && email.secondaryUrl ? `${email.secondaryLabel}: ${email.secondaryUrl}` : '', closing, email.unsubscribeUrl ? `Unsubscribe: ${email.unsubscribeUrl}` : ''].filter(Boolean).join('\n\n');
  return { subject: email.subject, html, text };
}

const input = JSON.parse(readFileSync(resolve(__dirname, '../emails/adhoc-sample.json'), 'utf8')) as AdhocEmailInput;
const { subject, html, text } = render(input);
console.log(`SUBJECT: ${subject}`);
console.log(`\n--- HTML ---\n${html}`);
console.log(`\n--- TEXT ---\n${text}`);

