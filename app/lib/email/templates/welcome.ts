/**
 * Welcome email template — sent after a user confirms their email address.
 *
 * Triggered from the auth callback when a new user completes email
 * verification. Single CTA: "Confirm Email" button linking to the
 * dashboard so the user lands straight in the app.
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
  /** The workspace slug, used to build the dashboard link. */
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
  const dashboardUrl = `${appUrl}/${workspaceSlug}`;

  const innerHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">Hi ${escapeHtml(firstName)},</p>
    ${paraHtml(`Welcome to <strong style="color:#F97316;">QuoteCore+</strong> — we're glad to have you on board.`)}
    ${paraHtml(`Your account is ready. Click below to confirm your email and start quoting, measuring, and managing jobs right away.`)}
    ${ctaBlock('Confirm Email', dashboardUrl)}
    ${note("If you didn't create an account, you can safely ignore this email.")}
  `;

  const html = renderEmailLayout({
    heading: 'Welcome to QuoteCore+',
    innerHtml,
    preheader: `Hi ${firstName}, welcome to QuoteCore+ — your quoting and job management toolkit.`,
  });

  const text = `Hi ${firstName},

Welcome to QuoteCore+ — we're glad to have you on board.

Your account is ready. Click below to confirm your email and start quoting, measuring, and managing jobs right away:

${dashboardUrl}

If you didn't create an account, you can safely ignore this email.

— The QuoteCore+ team`;

  return {
    subject: 'Welcome to QuoteCore+ — let\'s get started',
    html,
    text,
  };
}
