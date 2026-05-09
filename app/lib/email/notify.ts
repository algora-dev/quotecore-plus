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
import { quoteSummaryUrl, passwordResetStartUrl } from './urls';
import {
  quoteAcceptedEmail,
  quoteDeclinedEmail,
  revisionRequestedEmail,
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
