/**
 * Typed wrapper around Resend's send call. Always best-effort: caller paths
 * (quote acceptance, settings updates, etc.) must not fail if email sending
 * fails. We log on error and return a discriminated result.
 */

import 'server-only';
import { getResendClient, EMAIL_FROM, EMAIL_REPLY_TO_DEFAULT } from './client';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text fallback. Recommended for deliverability. */
  text?: string;
  /** Override reply-to. Defaults to info@quote-core.com. */
  replyTo?: string;
  /**
   * Override the `From:` line. MUST still be on a verified Resend domain.
   * Use this to carry a friendly display name (e.g.
   * `"Acme Roofing via QuoteCore+" <noreply@quote-core.com>`). When unset,
   * `EMAIL_FROM` from client.ts applies.
   */
  from?: string;
  /** Optional Resend tags for analytics/filtering in the dashboard. */
  tags?: { name: string; value: string }[];
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sends an email via Resend. Returns ok:false (never throws) on failure so
 * callers can ignore the result safely.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getResendClient();
  if (!client) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: input.from ?? EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? EMAIL_REPLY_TO_DEFAULT,
      tags: input.tags,
    });

    if (error) {
      console.error('[email] Resend returned error:', error);
      return { ok: false, error: error.message ?? 'Resend error' };
    }
    if (!data?.id) {
      return { ok: false, error: 'Resend returned no id' };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[email] sendEmail threw:', msg);
    return { ok: false, error: msg };
  }
}
