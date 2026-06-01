import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Server-only resolver that turns a client-supplied SELECTION of attachment
 * IDs into authorised `message_attachments` rows for one outbound send.
 *
 * SECURITY (Gerald H-03 surface): the client only ever sends opaque IDs.
 * This module is the single place that:
 *   1. Verifies each library id belongs to `companyId` AND is not archived.
 *   2. Verifies each quote_file id belongs to a quote owned by `companyId`.
 *   3. SILENTLY DROPS any id that doesn't resolve - we never trust the list,
 *      never surface "id X not found" (which would leak existence), and never
 *      let an unresolved id abort the send.
 *   4. Snapshots `display_name` at send time so a later library delete still
 *      shows a sane label (the download route re-checks live existence).
 *
 * Raw storage paths NEVER appear on the resolver's input or output. The
 * download route is the only code path that resolves a path, and only after
 * its own token-gated authorisation.
 */

export interface ResolveOutboundAttachmentsInput {
  companyId: string;
  /** Scope: at most one of quoteId / orderId. Neither => standalone send. */
  quoteId?: string | null;
  orderId?: string | null;
  /** Client-supplied selection - IDs only. */
  libraryAttachmentIds?: string[];
  quoteFileIds?: string[];
}

export interface ResolvedAttachmentRow {
  id: string;
  displayName: string;
  /** Only populated for standalone sends (no quote/order scope). */
  accessToken: string | null;
}

/** De-dupe + drop empties from a possibly-dirty client id list. */
function cleanIds(ids: string[] | undefined): string[] {
  if (!ids || ids.length === 0) return [];
  return Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0)));
}

/**
 * Resolve + persist the attachments for one outbound send.
 *
 * Returns the created `message_attachments` rows (id, displayName, and the
 * standalone accessToken when applicable). Returns an empty array when nothing
 * resolved - callers treat "no attachments" and "all ids dropped" identically.
 */
export async function resolveOutboundAttachments(
  input: ResolveOutboundAttachmentsInput,
): Promise<ResolvedAttachmentRow[]> {
  const { companyId } = input;
  if (!companyId) return [];

  const quoteId = input.quoteId ?? null;
  const orderId = input.orderId ?? null;
  // quote/order are mutually exclusive (mirrors sendOutboundMessage's rule);
  // if both somehow arrive, treat as no valid scope and bail.
  if (quoteId && orderId) return [];
  const isStandalone = !quoteId && !orderId;

  const libraryIds = cleanIds(input.libraryAttachmentIds);
  const quoteFileIds = cleanIds(input.quoteFileIds);
  if (libraryIds.length === 0 && quoteFileIds.length === 0) return [];

  const admin = createAdminClient();

  // ---- Resolve library files: must belong to this company + be active. ----
  const resolvedLibrary: Array<{ id: string; displayName: string }> = [];
  if (libraryIds.length > 0) {
    const { data, error } = await admin
      .from('company_attachments')
      .select('id, name, file_name')
      .in('id', libraryIds)
      .eq('company_id', companyId)
      .is('archived_at', null);
    if (!error && data) {
      for (const row of data) {
        resolvedLibrary.push({ id: row.id, displayName: row.name || row.file_name || 'Attachment' });
      }
    }
  }

  // ---- Resolve quote files: only meaningful when scoped to a quote. ----
  // The quote_file_id FK + the message_attachments quote_id scope mean a
  // quote file can only ever be attached to its own quote. We additionally
  // verify the quote belongs to the company before trusting any file.
  const resolvedQuoteFiles: Array<{ id: string; displayName: string }> = [];
  if (quoteFileIds.length > 0 && quoteId) {
    const { data: quoteRow } = await admin
      .from('quotes')
      .select('id')
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (quoteRow) {
      const { data, error } = await admin
        .from('quote_files')
        .select('id, file_name')
        .in('id', quoteFileIds)
        .eq('quote_id', quoteId);
      if (!error && data) {
        for (const row of data) {
          resolvedQuoteFiles.push({ id: row.id, displayName: row.file_name || 'File' });
        }
      }
    }
  }

  if (resolvedLibrary.length === 0 && resolvedQuoteFiles.length === 0) return [];

  // ---- Build insert rows. Exactly one source id non-null per row; scope
  // set to quote_id/order_id, or standalone with a fresh access_token. ----
  type InsertRow = {
    company_id: string;
    quote_id: string | null;
    order_id: string | null;
    library_attachment_id: string | null;
    quote_file_id: string | null;
    access_token: string | null;
    display_name: string;
  };

  const inserts: InsertRow[] = [];
  for (const lib of resolvedLibrary) {
    inserts.push({
      company_id: companyId,
      quote_id: quoteId,
      order_id: orderId,
      library_attachment_id: lib.id,
      quote_file_id: null,
      access_token: isStandalone ? crypto.randomUUID() : null,
      display_name: lib.displayName,
    });
  }
  for (const qf of resolvedQuoteFiles) {
    // quote_files only attach in a quote scope, never standalone, so no
    // access_token is needed here.
    inserts.push({
      company_id: companyId,
      quote_id: quoteId,
      order_id: orderId,
      library_attachment_id: null,
      quote_file_id: qf.id,
      access_token: null,
      display_name: qf.displayName,
    });
  }

  const { data: created, error: insertError } = await admin
    .from('message_attachments')
    .insert(inserts)
    .select('id, display_name, access_token');

  if (insertError || !created) {
    console.error('[resolveOutboundAttachments] insert failed:', insertError?.message);
    return [];
  }

  return created.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    accessToken: row.access_token,
  }));
}
