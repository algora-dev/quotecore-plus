/**
 * Welcome email template — sent after a user confirms their email address.
 *
 * Two variants:
 *   - Email/password signup: sent from /auth/callback after first
 *     confirmation. Single CTA: "Confirm Email" → dashboard.
 *   - Google signup: sent from completeGoogleOnboarding after onboarding.
 *     Includes a Tutorials blurb + "Go to Tutorials" button (Google users
 *     are auto-confirmed by Supabase, so they get the richer email).
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
  /**
   * Whether this is a Google OAuth signup. Google users get the Tutorials
   * blurb + button. Email/password users get the single "Confirm Email"
   * CTA only.
   */
  isGoogleSignup?: boolean;
};

export function renderWelcomeEmail({ fullName, workspaceSlug, appUrl, isGoogleSignup = false }: WelcomeEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = fullName.split(' ')[0] || fullName;
  const dashboardUrl = `${appUrl}/${workspaceSlug}`;
  const tutorialsUrl = `${appUrl}/${workspaceSlug}/tutorials`;

  let innerHtml: string;
  let text: string;

  if (isGoogleSignup) {
    // Google signup variant: Tutorials blurb + button.
    innerHtml = `
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
      ${note("If you didn't create an account, you can safely ignore this email.")}
    `;

    text = `Hi ${firstName},

Welcome to QuoteCore+ — we're glad to have you on board.

Your account is ready. You can start quoting, measuring, and managing jobs right away.

New here? Check out our tutorials to get up and running in minutes: ${tutorialsUrl}

If you didn't create an account, you can safely ignore this email.

— The QuoteCore+ team`;
  } else {
    // Email/password confirmation variant: single "Confirm Email" CTA.
    innerHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#374151;">Hi ${escapeHtml(firstName)},</p>
      ${paraHtml(`Welcome to <strong style="color:#F97316;">QuoteCore+</strong> — we're glad to have you on board.`)}
      ${paraHtml(`Your account is ready. Click below to confirm your email and start quoting, measuring, and managing jobs right away.`)}
      ${ctaBlock('Confirm Email', dashboardUrl)}
      ${note("If you didn't create an account, you can safely ignore this email.")}
    `;

    text = `Hi ${firstName},

Welcome to QuoteCore+ — we're glad to have you on board.

Your account is ready. Click below to confirm your email and start quoting, measuring, and managing jobs right away:

${dashboardUrl}

If you didn't create an account, you can safely ignore this email.

— The QuoteCore+ team`;
  }

  const html = renderEmailLayout({
    heading: 'Welcome to QuoteCore+',
    innerHtml,
    preheader: `Hi ${firstName}, welcome to QuoteCore+ — your quoting and job management toolkit.`,
  });

  return {
    subject: 'Welcome to QuoteCore+ — let\'s get started',
    html,
    text,
  };
}
