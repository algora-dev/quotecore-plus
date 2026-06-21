/**
 * Notification orchestrator.
 *
 * Each `notify*` function:
 *  1. Resolves the right recipients (company-wide for alerts, single user for security).
 *  2. Looks up any extra context (workspace slug for deep links).
 *  3. Sends an email per recipient and tags it for analytics in the Resend dashboard.
 *
 * All functions are best-effort: they swallow errors and never re-throw. The
 * in-app alert / database write that triggered them is the source of truth.
 */

import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { sendEmail } from './send';
import { getCompanyAlertRecipients, getUserById } from './recipients';
import { quoteSummaryUrl, passwordResetStartUrl, getSiteUrl } from './urls';
import {
  quoteAcceptedEmail,
  quoteDeclinedEmail,
  revisionRequestedEmail,
  genericAlertEmail,
} from './templates/alerts';
import {
  recoveryCodeUsedEmail,
  passwordChangedEmail,
  twoFactorEnabledEmail,
  twoFactorDisabledEmail,
  type SecurityEventBase,
} from './templates/security';

async function getWorkspaceSlug(companyId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('companies')
    .select('slug')
    .eq('id', companyId)
    .single();
  return data?.slug ?? null;
}

/* ============================================================
   Alert emails (gated by user preference)
   ============================================================ */

export async function notifyQuoteResponse(input: {
  companyId: string;
  quoteId: string;
  quoteNumber: number | null;
  customerName: string | null;
  isAccept: boolean;
}): Promise<void> {
  try {
    const slug = await getWorkspaceSlug(input.companyId);
    if (!slug) return;
    const recipients = await getCompanyAlertRecipients(input.companyId);
    if (recipients.length === 0) return;
    const url = quoteSummaryUrl(slug, input.quoteId);
    const builder = input.isAccept ? quoteAcceptedEmail : quoteDeclinedEmail;
    const tagValue = input.isAccept ? 'quote_accepted' : 'quote_declined';

    await Promise.all(
      recipients.map((r) => {
        const { subject, html, text } = builder({
          recipientName: r.fullName,
          customerName: input.customerName,
          quoteNumber: input.quoteNumber !== null ? String(input.quoteNumber) : null,
          quoteUrl: url,
        });
        return sendEmail({
          to: r.email,
          subject,
          html,
          text,
          tags: [
            { name: 'category', value: 'alert' },
            { name: 'event', value: tagValue },
          ],
        });
      })
    );
  } catch (err) {
    console.error('[email] notifyQuoteResponse failed:', err);
  }
}

export async function notifyRevisionRequested(input: {
  companyId: string;
  quoteId: string;
  quoteNumber: number | null;
  creatorUserId?: string | null;
  customerNameForEmail: string | null;
  notes: string;
  sourceState: 'active' | 'responded' | 'expired' | 'withdrawn';
}): Promise<void> {
  try {
    const slug = await getWorkspaceSlug(input.companyId);
    if (!slug) return;
    const recipients = await getCompanyAlertRecipients(input.companyId, input.creatorUserId ?? null);
    if (recipients.length === 0) return;
    const url = quoteSummaryUrl(slug, input.quoteId);

    await Promise.all(
      recipients.map((r) => {
        const { subject, html, text } = revisionRequestedEmail({
          recipientName: r.fullName,
          customerName: input.customerNameForEmail,
          quoteNumber: input.quoteNumber !== null ? String(input.quoteNumber) : null,
          notes: input.notes,
          sourceState: input.sourceState,
          quoteUrl: url,
        });
        return sendEmail({
          to: r.email,
          subject,
          html,
          text,
          tags: [
            { name: 'category', value: 'alert' },
            { name: 'event', value: 'revision_requested' },
          ],
        });
      })
    );
  } catch (err) {
    console.error('[email] notifyRevisionRequested failed:', err);
  }
}

/**
 * Generic alert email - the reusable path for order / invoice / read-receipt
 * events that don't warrant a bespoke template. Sends one branded email to
 * every company alert recipient. Best-effort: swallows all errors so it can
 * never block the status update / response that triggered it.
 *
 * GATING IS THE CALLER'S JOB: check `emailAlertEnabled(client, companyId,
 * alertType)` before calling this. We only tag the email with the alertType.
 */
export async function notifyGenericAlert(input: {
  companyId: string;
  alertType: string;
  title: string;
  body: string;
  ctaUrl?: string | null;
  ctaLabel?: string;
}): Promise<void> {
  try {
    const recipients = await getCompanyAlertRecipients(input.companyId);
    if (recipients.length === 0) return;
    await Promise.all(
      recipients.map((r) => {
        const { subject, html, text } = genericAlertEmail({
          recipientName: r.fullName,
          title: input.title,
          body: input.body,
          ctaUrl: input.ctaUrl ?? null,
          ctaLabel: input.ctaLabel,
        });
        return sendEmail({
          to: r.email,
          subject,
          html,
          text,
          tags: [
            { name: 'category', value: 'alert' },
            { name: 'event', value: input.alertType },
          ],
        });
      })
    );
  } catch (err) {
    console.error(`[email] notifyGenericAlert (${input.alertType}) failed:`, err);
  }
}

/**
 * Quote expiry notification — sent by the expire-quotes cron when a quote
 * passes its valid_until deadline with no customer response.
 * GATING IS THE CALLER'S JOB: check emailAlertEnabled before calling.
 */
export async function notifyQuoteExpired(input: {
  companyId: string;
  quoteId: string;
  quoteNumber: number | null;
  customerName: string | null;
}): Promise<void> {
  try {
    const slug = await getWorkspaceSlug(input.companyId);
    if (!slug) return;
    const url = quoteSummaryUrl(slug, input.quoteId);
    const quoteRef = input.quoteNumber ? `#${input.quoteNumber}` : 'a quote';
    const customerName = input.customerName || 'the customer';
    await notifyGenericAlert({
      companyId: input.companyId,
      alertType: 'quote_expired',
      title: `Quote ${quoteRef} has expired`,
      body: `Your quote for ${customerName} has expired with no response from the customer. You can resend or review it below.`,
      ctaUrl: url,
      ctaLabel: 'View quote',
    });
  } catch (err) {
    console.error('[email] notifyQuoteExpired failed:', err);
  }
}

/* ============================================================
   Security emails (always sent, never gated)
   ============================================================ */

type SecuritySendInput = {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
};

async function sendSecurityEmail(
  input: SecuritySendInput,
  builder: (s: SecurityEventBase) => { subject: string; html: string; text?: string },
  tagValue: string
): Promise<void> {
  try {
    const user = await getUserById(input.userId);
    if (!user) return;
    const { subject, html, text } = builder({
      recipientName: user.fullName,
      eventAt: new Date().toISOString(),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      secureAccountUrl: passwordResetStartUrl(),
    });
    await sendEmail({
      to: user.email,
      subject,
      html,
      text,
      tags: [
        { name: 'category', value: 'security' },
        { name: 'event', value: tagValue },
      ],
    });
  } catch (err) {
    console.error(`[email] sendSecurityEmail (${tagValue}) failed:`, err);
  }
}

export const notifyRecoveryCodeUsed = (i: SecuritySendInput) =>
  sendSecurityEmail(i, recoveryCodeUsedEmail, 'recovery_code_used');

export const notifyPasswordChanged = (i: SecuritySendInput) =>
  sendSecurityEmail(i, passwordChangedEmail, 'password_changed');

export const notifyTwoFactorEnabled = (i: SecuritySendInput) =>
  sendSecurityEmail(i, twoFactorEnabledEmail, 'two_factor_enabled');

export const notifyTwoFactorDisabled = (i: SecuritySendInput) =>
  sendSecurityEmail(i, twoFactorDisabledEmail, 'two_factor_disabled');

/**
 * Send a best-effort email to a customer informing them that the quote
 * acceptance window has been extended. Called by `updateQuoteExpiry` when
 * the quote has a customer_email address on record.
 *
 * This keeps the same acceptance link alive (same token) and just notifies
 * the customer that they have more time to respond.
 */
export async function notifyCustomerExpiryExtended(input: {
  customerEmail: string;
  customerName: string | null;
  companyName: string | null;
  quoteNumber: number | null;
  acceptanceToken: string;
  newExpiryIso: string;
}): Promise<void> {
  try {
    const { customerEmail, customerName, companyName, quoteNumber, acceptanceToken, newExpiryIso } = input;
    const firstName = customerName ? customerName.split(' ')[0] : null;
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
    const quoteRef = quoteNumber ? `Quote #${quoteNumber}` : 'Your quote';
    const fromCompany = companyName ? ` from ${companyName}` : '';
    const acceptUrl = `${getSiteUrl()}/accept/${encodeURIComponent(acceptanceToken)}`;
    const newExpiryFormatted = new Date(newExpiryIso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const subject = `${quoteRef}${fromCompany} — acceptance window extended`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>${subject}</title></head>
<body style="margin:0;padding:24px;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="560" style="background:#fff;border-radius:8px;padding:32px 40px;border:1px solid #E5E7EB;">
<tr><td>
  <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">${companyName ?? 'QuoteCore+'}</p>
  <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#111827;">${greeting}</h1>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${quoteRef}${fromCompany} has been updated — the acceptance deadline has been extended to <strong>${newExpiryFormatted}</strong>.</p>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">Your original link is still valid and ready to use:</p>
  <table cellpadding="0" cellspacing="0"><tr><td style="background:#111827;border-radius:20px;padding:10px 24px;">
    <a href="${acceptUrl}" style="color:#fff;font-size:14px;font-weight:600;text-decoration:none;">View &amp; Accept Quote</a>
  </td></tr></table>
  <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;">Or copy this link: ${acceptUrl}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

    const text = `${greeting}\n\n${quoteRef}${fromCompany} has been updated — the acceptance deadline has been extended to ${newExpiryFormatted}.\n\nView and accept your quote here:\n${acceptUrl}`;

    await sendEmail({
      to: customerEmail,
      subject,
      html,
      text,
      tags: [{ name: 'type', value: 'customer_expiry_extended' }],
    });
  } catch (err) {
    console.error('[email] notifyCustomerExpiryExtended failed:', err);
  }
}
