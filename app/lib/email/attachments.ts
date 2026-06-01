/**
 * Email attachment builder.
 *
 * Bridges the gap between "a list of files the user chose to attach" (stored
 * as storage paths in `quote_files` / `company_attachments`) and the raw-bytes
 * shape `sendEmail()` needs to hand to Resend.
 *
 * Trust model: callers MUST have already verified that every storage path
 * belongs to the sending company/quote before calling this. This module does
 * NOT re-check ownership - it downloads whatever paths it is given via the
 * service-role storage client. The authoritative ownership gates live in the
 * server actions that assemble the attachment list (quote send, acceptance
 * auto-message), which only ever pass paths sourced from RLS-bound queries.
 *
 * Best-effort: an individual file that fails to download is skipped (and
 * logged) rather than aborting the whole email. The total-payload size guard
 * lives in `sendEmail()` itself.
 */

import 'server-only';
import { downloadStorageObject } from '@/app/lib/storage/helpers';
import { BUCKETS } from '@/app/lib/storage/buckets';
import type { EmailAttachment } from './send';

export type AttachmentSource = {
  /** Path inside the QUOTE-DOCUMENTS bucket. */
  storagePath: string;
  /** Display filename shown to the recipient. */
  fileName: string;
};

/**
 * Resolve a list of storage-backed attachment sources into raw-bytes
 * `EmailAttachment` objects ready for `sendEmail()`.
 *
 * Files are downloaded in parallel. Any that fail are dropped from the result
 * with a logged warning - the email still sends with whatever resolved.
 */
export async function buildEmailAttachments(
  sources: AttachmentSource[],
): Promise<EmailAttachment[]> {
  if (!sources || sources.length === 0) return [];

  const settled = await Promise.allSettled(
    sources.map(async (src) => {
      const content = await downloadStorageObject(BUCKETS.QUOTE_DOCUMENTS, src.storagePath);
      return { filename: src.fileName, content };
    }),
  );

  const attachments: EmailAttachment[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === 'fulfilled') {
      attachments.push(result.value);
    } else {
      console.error(
        `[email/attachments] Skipping attachment ${sources[i]?.storagePath}:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
    }
  }

  return attachments;
}
