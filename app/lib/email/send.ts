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
  /**
   * Optional file attachments. Each entry carries the raw bytes plus a
   * display filename. Built by `app/lib/email/attachments.ts` from the
   * private QUOTE-DOCUMENTS bucket. Resend caps the TOTAL message payload
   * (sum of all attachments + html) at ~40MB; we guard against that here
   * so an over-size send fails fast with a clear error rather than a
   * cryptic Resend rejection.
   */
  attachments?: EmailAttachment[];
};

export type EmailAttachment = {
  /** Filename shown to the recipient, e.g. "Terms of Service.pdf". */
  filename: string;
  /** Raw file bytes. */
  content: Buffer;
};

/**
 * Resend's hard limit on total message size is ~40MB. We use a slightly
 * conservative ceiling to leave headroom for the html body, headers, and
 * base64 encoding overhead (~33% inflation on the wire). This is NOT a
 * product cap on file size - per-file limits and storage quotas live
 * elsewhere. This is purely the deliverability hard-fact guard.
 */
const MAX_TOTAL_ATTACHMENT_BYTES = 38 * 1024 * 1024; // 38 MB raw

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

  // Deliverability guard: reject before hitting Resend if the combined raw
  // attachment payload exceeds the message-size ceiling. Base64 on the wire
  // inflates this further, so the conservative ceiling protects us.
  if (input.attachments && input.attachments.length > 0) {
    const totalBytes = input.attachments.reduce((sum, a) => sum + a.content.length, 0);
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      const mb = (totalBytes / 1024 / 1024).toFixed(1);
      return {
        ok: false,
        error: `Attachments total ${mb}MB, which exceeds the ${Math.round(
          MAX_TOTAL_ATTACHMENT_BYTES / 1024 / 1024,
        )}MB email limit. Remove or shrink some files and try again.`,
      };
    }
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
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
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
