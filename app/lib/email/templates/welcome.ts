/**
 * Welcome email template — sent after a user confirms their email address.
 *
 * Triggered from the auth callback when a new user completes email
 * verification. Includes the user's name, a thanks-for-joining message,
 * a link to the tutorials page, and a prompt to ask Q (the in-app
 * assistant) if they need help.
 */

import 'server-only';
import { renderEmailLayout, paraHtml, ctaBlock, note } from '../baseLayout';

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export type WelcomeEmailInput = {
  /** The user's full name (from signup). */
  fullName: string;
  /** The workspace slug, used to build the tutorials link. */
  workspaceSlug: string;
  /** Base URL of the app (e.g. https://quotecore-plus-main.vercel.app). */
  appUrl: string;
};

export function renderWelcomeEmail({ fullName, workspaceSlug, appUrl }: WelcomeEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = fullName.split(' ')[0] || fullName;
  const tutorialsUrl = `${appUrl}/${workspaceSlug}/tutorials`;
  const dashboardUrl = `${appUrl}/${workspaceSlug}`;

  const innerHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">Hi ${escapeHtml(firstName)},</p>
    ${paraHtml(`Welcome to <strong style="color:#F97316;">QuoteCore+</strong> — we're glad to have you on board.`)}
    ${paraHtml(`Your account is ready. You can start quoting, measuring, and managing jobs right away.`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;">
      <tr><td style="padding:12px 16px;background-color:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;">
        <p style="margin:0;font-size:14px;line-height:22px;color:#9A3412;">
          <strong>New here?</strong> Check out our tutorials to get up and running in minutes — from setting up your company to sending your first quote.
        </p>
      </td></tr>
    </table>
    ${ctaBlock('Go to Tutorials', tutorialsUrl)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 0 0;">
      <tr><td style="padding:0;">
        <p style="margin:0 0 8px 0;font-size:15px;line-height:24px;color:#374151;">Need a hand with something specific?</p>
        <p style="margin:0;font-size:14px;line-height:22px;color:#6B7280;">
          Look for <strong style="color:#F97316;">Q</strong> — the circular button in the bottom-right corner of any page. Q is your built-in assistant: ask it questions, get step-by-step walkthroughs, and learn how to use every feature in QuoteCore+.
        </p>
      </td></tr>
    </table>
    ${ctaBlock('Open QuoteCore+', dashboardUrl, 'Or go straight to your dashboard:')}
    ${note("If you didn't create an account, you can safely ignore this email.")}
  `;

  const html = renderEmailLayout({
    heading: 'Welcome to QuoteCore+',
    innerHtml,
    preheader: `Hi ${firstName}, welcome to QuoteCore+ — your quoting and job management toolkit.`,
  });

  const text = `Hi ${firstName},

Welcome to QuoteCore+ — we're glad to have you on board.

Your account is ready. You can start quoting, measuring, and managing jobs right away.

New here? Check out our tutorials to get up and running in minutes: ${tutorialsUrl}

Need a hand with something specific? Look for Q — the circular button in the bottom-right corner of any page. Q is your built-in assistant: ask it questions, get step-by-step walkthroughs, and learn how to use every feature in QuoteCore+.

Open QuoteCore+: ${dashboardUrl}

If you didn't create an account, you can safely ignore this email.

— The QuoteCore+ team`;

  return {
    subject: 'Welcome to QuoteCore+ — let\'s get started',
    html,
    text,
  };
}
