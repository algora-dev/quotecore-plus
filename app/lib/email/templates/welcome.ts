/**
 * Welcome email (owner copy finalized 2026-11-20 09:43).
 *
 * Sent ~5 minutes after a Free Workspace is first provisioned - the queue
 * row is enqueued by provisionFreeWorkspace() in complete-signin.ts, which
 * both signup paths (Google OAuth + email/password confirmation) run
 * through, and dispatched by the scheduled-messages cron sweep
 * (app/lib/email/welcomeQueue.ts).
 *
 * Deliberately different from other transactional emails:
 *  - Sent FROM Shaun ("Shaun at QuoteCore+") with reply-to shaun@, because
 *    the copy invites replies (owner replies train Gmail Primary delivery,
 *    per the 2026-11-17 outreach learnings).
 *  - Footer is reply-friendly (no "automated message - don't reply" line).
 *  - Help options are plain text links (owner preference 2026-11-20), not
 *    buttons - the single orange CTA opens the Free Workspace itself
 *    (owner 10:19: quote-core.com/demo is the OLD public demo and has
 *    nothing to do with the user's workspace; the CTA must open the app
 *    "like it normally would", with no raw-URL fallback line under it).
 */

import 'server-only';
import { renderEmailLayout, paraHtml, escapeHtml } from '../baseLayout';

export const WELCOME_EMAIL_SUBJECT = 'Welcome to QuoteCore+! Your quickest path to better quotes';
export const WELCOME_EMAIL_FROM = 'Shaun at QuoteCore+ <shaun@quote-core.com>';
export const WELCOME_EMAIL_REPLY_TO = 'shaun@quote-core.com';

// Owner 2026-11-20 10:19: the CTA opens the user's Free Workspace (the app),
// not the public demo. Same env pattern as buildOutreachUnsubscribeUrl.
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.quote-core.com';
const YOUR_JOB_URL = 'https://quote-core.com/your-job-demo';
const CALENDLY_URL = 'https://calendly.com/quote-core-info/meeting';
const QUICK_START_URL = 'https://quote-core.com/quick-start-pricing';
const DONE_FOR_YOU_URL = 'https://quote-core.com/done-for-you-setup';

const link = (url: string, label: string) =>
  `<a href="${escapeHtml(url)}" style="color:#F97316;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>`;

/** One recommendation row: bold title + description. */
const step = (title: string, desc: string) => `
<tr><td style="padding:0 0 14px 0;">
  <p style="margin:0;font-size:15px;line-height:22px;color:#0A0A0A;font-weight:600;">${escapeHtml(title)}</p>
  <p style="margin:2px 0 0 0;font-size:14px;line-height:21px;color:#374151;">${escapeHtml(desc)}</p>
</td></tr>`;

/** One help option: link on its own line + em-dash description. */
const helpOption = (url: string, label: string, desc: string) => `
<p style="margin:0 0 10px 0;font-size:14px;line-height:21px;color:#374151;">
  ${link(url, label)} &mdash; ${escapeHtml(desc)}
</p>`;

export type WelcomeEmailInput = {
  /** The user's first name (single word, pre-trimmed). */
  firstName: string | null | undefined;
  /** Per-recipient unsubscribe URL (HMAC token, same scheme as outreach). */
  unsubscribeUrl: string;
};

export function renderWelcomeEmail({ firstName, unsubscribeUrl }: WelcomeEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const name = (firstName ?? '').trim() || 'there';

  const innerHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">Hi ${escapeHtml(name)},</p>
      ${paraHtml(`Welcome to <strong style="color:#F97316;">QuoteCore+</strong>! Your Free Workspace is ready.`)}
      ${paraHtml(`We know you want to see if QuoteCore+ can make quoting <strong>faster, easier, and more accurate</strong>, without spending hours figuring it out.`)}
      ${paraHtml(`Built by roofers, for roofers, QuoteCore+ supports different ways of working. It&rsquo;s just a matter of finding what works best for you.`)}
      <p style="margin:24px 0 10px 0;font-size:15px;line-height:22px;color:#0A0A0A;font-weight:600;">Here&rsquo;s what we recommend:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px 0;">
        ${step('1. Try the guided demo (about 10 minutes)', 'Complete 4 short tasks to see how pricing, measuring, and quoting work together.')}
        ${step('2. Explore the demo business', 'Browse completed jobs, saved pricing, and finished quotes to see how everything connects.')}
        ${step('3. Switch to your Free Workspace and add your own pricing', 'Once your pricing is saved, turning measurements and quantities into accurate quotes becomes much faster and easier.')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 12px 0;"><tr><td style="background-color:#F97316;border-radius:8px;">
        <a href="${escapeHtml(APP_URL)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">Open your Free Workspace</a>
      </td></tr></table>
      <p style="margin:32px 0 10px 0;font-size:15px;line-height:22px;color:#0A0A0A;font-weight:600;">Need help? We&rsquo;ve got you covered.</p>
      ${helpOption(YOUR_JOB_URL, 'Send us a job', 'Get a free video showing how we\u2019d quote it in QuoteCore+.')}
      ${helpOption(CALENDLY_URL, 'Book a free 25-minute call', 'I\u2019ll show you how it fits your workflow.')}
      ${helpOption(QUICK_START_URL, 'Quick Start', 'We\u2019ll set up your pricing.')}
      ${helpOption(DONE_FOR_YOU_URL, 'Done For You', 'Setup, personalized training, and ongoing support.')}
      ${paraHtml(`Or simply <strong>reply to this email</strong> and tell me what you need help with.`)}
      <p style="margin:28px 0 0 0;font-size:15px;line-height:24px;color:#374151;">Cheers,<br/><strong style="color:#0A0A0A;">Shaun</strong><br/>
        <span style="font-size:13px;color:#6B7280;">Founder, QuoteCore+ &bull; 20+ years in roofing &amp; construction</span></p>
    `;

  const footerHtml = `<p style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#6B7280;">You&rsquo;re receiving this because you created a free QuoteCore+ workspace.</p>
<p style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#9CA3AF;">Hit reply &mdash; it goes straight to Shaun. &bull; <a href="${escapeHtml(unsubscribeUrl)}" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe</a></p>
<p style="margin:0;font-size:11px;line-height:16px;color:#9CA3AF;">QuoteCore<span style="color:#F97316;">+</span> &bull; <a href="https://quote-core.com" style="color:#9CA3AF;text-decoration:underline;">quote-core.com</a></p>`;

  const text = `Hi ${name},

Welcome to QuoteCore+! Your Free Workspace is ready.

We know you want to see if QuoteCore+ can make quoting faster, easier, and more accurate, without spending hours figuring it out.

Built by roofers, for roofers, QuoteCore+ supports different ways of working. It's just a matter of finding what works best for you.

Here's what we recommend:

1. Try the guided demo (about 10 minutes)
Complete 4 short tasks to see how pricing, measuring, and quoting work together.

2. Explore the demo business
Browse completed jobs, saved pricing, and finished quotes to see how everything connects.

3. Switch to your Free Workspace and add your own pricing
Once your pricing is saved, turning measurements and quantities into accurate quotes becomes much faster and easier.

Start the Guided Demo (inside your workspace): open your Free Workspace at ${APP_URL}

Need help? We've got you covered.

Send us a job (free video showing how we'd quote it in QuoteCore+): ${YOUR_JOB_URL}
Book a free 25-minute call: ${CALENDLY_URL}
Quick Start (we'll set up your pricing): ${QUICK_START_URL}
Done For You (setup, personalized training, and ongoing support): ${DONE_FOR_YOU_URL}

Or simply reply to this email and tell me what you need help with.

Cheers,
Shaun
Founder, QuoteCore+ - 20+ years in roofing & construction

You're receiving this because you created a free QuoteCore+ workspace.
Unsubscribe: ${unsubscribeUrl}`;

  const html = renderEmailLayout({
    heading: 'Welcome to QuoteCore+',
    innerHtml,
    preheader: 'Your Free Workspace is ready - here\u2019s the quickest path to faster, easier quotes.',
    footerHtml,
  });

  return { subject: WELCOME_EMAIL_SUBJECT, html, text };
}
