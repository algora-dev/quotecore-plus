/**
 * Security email templates. Always sent — never gated by user preference.
 *
 * Each one has the same structure:
 *  - Reassuring heading + summary
 *  - Event-detail table (when, where, what)
 *  - Clear CTA: "Was this you? Yes → ignore. No → secure account now."
 */

import { renderEmailLayout, ctaBlock, para, infoTable, note } from '../baseLayout';

export type SecurityEventBase = {
  recipientName?: string | null;
  /** ISO timestamp of the event. Renders in the user's email client locale. */
  eventAt: string;
  /** Optional IP address; pass undefined to omit. */
  ip?: string | null;
  /** Optional user-agent / browser hint. */
  userAgent?: string | null;
  /** URL to start a password reset / secure account flow. */
  secureAccountUrl: string;
};

function whenWhereRows(input: SecurityEventBase) {
  const rows: { label: string; value: string }[] = [
    { label: 'When', value: new Date(input.eventAt).toUTCString() },
  ];
  if (input.ip) rows.push({ label: 'IP address', value: input.ip });
  if (input.userAgent) rows.push({ label: 'Device', value: input.userAgent });
  return rows;
}

/* ---- Recovery code login ---- */

export function recoveryCodeUsedEmail(input: SecurityEventBase) {
  const subject = 'Recovery code used to sign in to QuoteCore+';
  const heading = 'Recovery code used';
  const inner =
    para(input.recipientName ? `Hi ${input.recipientName},` : 'Hi,') +
    para(
      'Someone just signed in to your QuoteCore+ account using a 2FA recovery code. If this was you, no further action is needed.'
    ) +
    infoTable(whenWhereRows(input)) +
    para('If this wasn\'t you, secure your account immediately by resetting your password and reviewing your 2FA settings.') +
    ctaBlock('Secure my account', input.secureAccountUrl, "If the button doesn't work, open this link:") +
    note('Recovery codes are single-use. The code that just signed in cannot be used again.');
  return {
    subject,
    html: renderEmailLayout({ heading, innerHtml: inner, preheader: 'A recovery code was just used on your account.' }),
    text: `A recovery code was used to sign in to your QuoteCore+ account at ${new Date(input.eventAt).toUTCString()}. If this wasn't you, secure your account: ${input.secureAccountUrl}`,
  };
}

/* ---- Password changed ---- */

export function passwordChangedEmail(input: SecurityEventBase) {
  const subject = 'Your QuoteCore+ password was changed';
  const heading = 'Password changed';
  const inner =
    para(input.recipientName ? `Hi ${input.recipientName},` : 'Hi,') +
    para('Your QuoteCore+ password was just changed. If this was you, no further action is needed.') +
    infoTable(whenWhereRows(input)) +
    para("If you didn't make this change, secure your account immediately.") +
    ctaBlock('Secure my account', input.secureAccountUrl);
  return {
    subject,
    html: renderEmailLayout({ heading, innerHtml: inner, preheader: 'Your QuoteCore+ password was just changed.' }),
    text: `Your QuoteCore+ password was changed at ${new Date(input.eventAt).toUTCString()}. If this wasn't you: ${input.secureAccountUrl}`,
  };
}

/* ---- 2FA enabled ---- */

export function twoFactorEnabledEmail(input: SecurityEventBase) {
  const subject = 'Two-factor authentication enabled on your QuoteCore+ account';
  const heading = '2FA enabled';
  const inner =
    para(input.recipientName ? `Hi ${input.recipientName},` : 'Hi,') +
    para('Two-factor authentication has been turned on for your QuoteCore+ account. From now on, sign-ins will require a code from your authenticator app.') +
    infoTable(whenWhereRows(input)) +
    para("If you didn't turn this on, your account may be at risk — secure it now.") +
    ctaBlock('Secure my account', input.secureAccountUrl) +
    note('Keep your recovery codes in a safe place. They are the only way to regain access if you lose your authenticator.');
  return {
    subject,
    html: renderEmailLayout({ heading, innerHtml: inner, preheader: '2FA was just enabled on your account.' }),
    text: `2FA was enabled on your QuoteCore+ account at ${new Date(input.eventAt).toUTCString()}. If this wasn't you: ${input.secureAccountUrl}`,
  };
}

/* ---- 2FA disabled ---- */

export function twoFactorDisabledEmail(input: SecurityEventBase) {
  const subject = 'Two-factor authentication disabled on your QuoteCore+ account';
  const heading = '2FA disabled';
  const inner =
    para(input.recipientName ? `Hi ${input.recipientName},` : 'Hi,') +
    para('Two-factor authentication has been turned off for your QuoteCore+ account. Your account is now protected by your password alone.') +
    infoTable(whenWhereRows(input)) +
    para("If you didn't turn this off, secure your account immediately — re-enabling 2FA is strongly recommended.") +
    ctaBlock('Secure my account', input.secureAccountUrl);
  return {
    subject,
    html: renderEmailLayout({ heading, innerHtml: inner, preheader: '2FA was just disabled on your account.' }),
    text: `2FA was disabled on your QuoteCore+ account at ${new Date(input.eventAt).toUTCString()}. If this wasn't you: ${input.secureAccountUrl}`,
  };
}
