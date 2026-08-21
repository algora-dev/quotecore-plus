import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const API_KEY = process.env.RESEND_API_KEY!;
const resend = new Resend(API_KEY);
// Allow per-run recipient + input override (for per-recipient signed unsubscribe links).
const TO = process.env.SEND_TO || 'cececarson1993@gmail.com';
const INPUT = process.env.SEND_INPUT || resolve(__dirname, '../emails/adhoc-live-test.json');
const j = JSON.parse(readFileSync(resolve(__dirname, INPUT), 'utf8'));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const LOGO = 'https://quotecore-plus-main.vercel.app/logo-email.png';
const para = (t: string) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">${esc(t)}</p>`;
const btn = (label: string, url: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;"><tr><td style="background-color:#F97316;border-radius:8px;"><a href="${esc(url)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">${esc(label)}</a></td></tr></table>`;
const offerPanel = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;width:100%;"><tr><td style="padding:24px;background-color:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:13px;line-height:18px;color:#9A3412;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your offer</td></tr><tr><td style="padding:8px 0 6px 0;font-size:28px;line-height:32px;font-weight:700;color:#0A0A0A;">${esc(j.discount.amount)}</td></tr><tr><td style="padding:0 0 4px 0;font-size:13px;line-height:20px;color:#374151;"><span style="background-color:#0A0A0A;color:#FFFFFF;font-weight:700;letter-spacing:1px;padding:4px 10px;border-radius:6px;">${esc(j.discount.code)}</span> &nbsp; ${esc(j.discount.duration)}</td></tr></table></td></tr></table>`;

const inner = [
  `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">Hi ${esc(j.firstName)},</p>`,
  para(j.intro[0]), para(j.intro[1]),
  para(j.body),
  offerPanel,
  `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">You can start your <strong>14-day free trial</strong> here - no card required:</p>`,
  btn('Start Your Free Trial', j.ctaUrl),
  para("Have a play with it, create a real quote and see how it fits into the way you work. I'd genuinely love to know what you think!"),
  `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">We've also been building a bunch of <strong>free tools for trades</strong> that you can use whenever you need them:</p>`,
  btn('Check Out the Free Tools', j.secondaryUrl),
  para("And if you get stuck, have a question, think something could be better, or just want to tell me what you think - reply to this email, I'll see it and be happy to help."),
  para('Thanks again for being here early. It really does mean a lot to us.'),
  `<p style="margin:24px 0 4px 0;font-size:15px;line-height:24px;color:#374151;">Cece</p><p style="margin:0;font-size:15px;line-height:24px;color:#374151;font-weight:700;">QuoteCore+</p>`
].join('\n');

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(j.heading)}</title></head><body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0A0A0A;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;"><tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid #F3F4F6;"><a href="https://quote-core.com/" style="text-decoration:none;border:0;"><img src="${LOGO}" alt="QuoteCore+" width="160" style="display:block;border:0;height:auto;max-width:160px;"/></a></td></tr><tr><td style="padding:32px;"><h1 style="margin:0 0 20px 0;font-size:22px;line-height:28px;font-weight:600;color:#0A0A0A;">${esc(j.heading)}</h1>${inner}</td></tr><tr><td style="padding:24px 32px;background-color:#F9FAFB;border-top:1px solid #F3F4F6;"><p style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#6B7280;">QuoteCore<span style="color:#F97316;">+</span> - Quoting &amp; job management for trades</p><p style="margin:0;font-size:12px;line-height:18px;color:#9CA3AF;"><a href="mailto:info@quote-core.com" style="color:#9CA3AF;text-decoration:underline;">info@quote-core.com</a> &bull; <a href="${esc(j.unsubscribeUrl)}" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`;

const text = [
  `Hi ${j.firstName},`,
  j.intro[0], j.intro[1],
  j.body,
  `Your offer: ${j.discount.amount} (code ${j.discount.code}) ${j.discount.duration}`,
  `Start your 14-day free trial here - no card required: ${j.ctaUrl}`,
  "Have a play with it, create a real quote and see how it fits into the way you work. I'd genuinely love to know what you think!",
  `We've also been building free tools for trades: ${j.secondaryUrl}`,
  "And if you get stuck, have a question, think something could be better, or just want to tell me what you think - reply to this email, I'll see it and be happy to help.",
  'Thanks again for being here early. It really does mean a lot to us.',
  'Cece',
  'QuoteCore+',
  `Unsubscribe: ${j.unsubscribeUrl}`
].join('\n\n');

async function sendSingle(): Promise<void> {
  const r = await resend.emails.send({
    from: 'QuoteCore+ <info@quote-core.com>',
    to: TO,
    subject: j.subject,
    html,
    text,
    replyTo: 'info@quote-core.com',
    tags: [{ name: 'category', value: 'outreach-test' }]
  });
  if (r.error) console.log('FAILED ' + TO + ': ' + (r.error as { message?: string }).message);
  else console.log('SENT ' + TO + ': ' + (r.data?.id ?? ''));
}
sendSingle();
