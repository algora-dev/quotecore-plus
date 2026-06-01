import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Shared, token-gated authorisation for attachment downloads + the standalone
 * file page. This is the ONLY module that maps a public token to a live
 * storage path, and it does so strictly after server-side authorisation.
 *
 * Token contexts (mirrors the three delivery contexts in the brief):
 *   - quote   : token = quotes.acceptance_token; the requested attachment row
 *               must belong to that quote (message_attachments.quote_id).
 *   - order   : token = material_orders.acceptance_token; attachment row must
 *               belong to that order.
 *   - standalone: token = message_attachments.access_token; the attachment row
 *               IS the one identified by the token.
 *
 * In every case we re-derive the file's real `company_id` from the underlying
 * source row (company_attachments / quote_files) and require it to match the
 * company that owns the token's quote/order/row. The raw storage path is
 * returned ONLY to the server caller, never to the client.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

export interface ResolvedDownload {
  storagePath: string;
  displayName: string;
  mimeType: string | null;
  companyId: string;
}

interface AttachmentRowShape {
  id: string;
  company_id: string;
  quote_id: string | null;
  order_id: string | null;
  library_attachment_id: string | null;
  quote_file_id: string | null;
  access_token: string | null;
  display_name: string;
}

/**
 * Re-derive the live storage path + mime for one message_attachments row,
 * asserting the underlying source still exists and belongs to `companyId`.
 * Returns null if the file was deleted or fails the company check.
 */
async function resolveSourceFile(
  admin: ReturnType<typeof createAdminClient>,
  row: AttachmentRowShape,
): Promise<ResolvedDownload | null> {
  if (row.library_attachment_id) {
    const { data } = await admin
      .from('company_attachments')
      .select('storage_path, mime_type, company_id')
      .eq('id', row.library_attachment_id)
      .eq('company_id', row.company_id)
      .maybeSingle();
    if (!data) return null;
    return {
      storagePath: data.storage_path,
      displayName: row.display_name,
      mimeType: data.mime_type,
      companyId: data.company_id,
    };
  }
  if (row.quote_file_id) {
    const { data } = await admin
      .from('quote_files')
      .select('storage_path, mime_type, company_id')
      .eq('id', row.quote_file_id)
      .eq('company_id', row.company_id)
      .maybeSingle();
    if (!data) return null;
    return {
      storagePath: data.storage_path,
      displayName: row.display_name,
      mimeType: data.mime_type,
      companyId: data.company_id,
    };
  }
  return null;
}

const ATTACHMENT_COLUMNS =
  'id, company_id, quote_id, order_id, library_attachment_id, quote_file_id, access_token, display_name';

/**
 * Resolve the full set of attachment rows visible behind a given token,
 * without resolving storage paths. Used by the hosted pages to LIST files.
 * Returns the scope + display rows (id + name) only.
 */
export async function listAttachmentsForToken(
  token: string,
): Promise<{
  scope: 'quote' | 'order' | 'standalone';
  companyId: string;
  rows: Array<{ id: string; displayName: string }>;
} | null> {
  if (!isUuid(token)) return null;
  const admin = createAdminClient();

  // Quote context.
  const { data: quote } = await admin
    .from('quotes')
    .select('id, company_id')
    .eq('acceptance_token', token)
    .maybeSingle();
  if (quote) {
    const { data } = await admin
      .from('message_attachments')
      .select('id, display_name')
      .eq('quote_id', quote.id)
      .order('created_at', { ascending: true });
    return {
      scope: 'quote',
      companyId: quote.company_id,
      rows: (data ?? []).map((r) => ({ id: r.id, displayName: r.display_name })),
    };
  }

  // Order context.
  const { data: order } = await admin
    .from('material_orders')
    .select('id, company_id')
    .eq('acceptance_token', token)
    .maybeSingle();
  if (order) {
    const { data } = await admin
      .from('message_attachments')
      .select('id, display_name')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });
    return {
      scope: 'order',
      companyId: order.company_id,
      rows: (data ?? []).map((r) => ({ id: r.id, displayName: r.display_name })),
    };
  }

  // Standalone context: token IS the access_token on a single row.
  const { data: standalone } = await admin
    .from('message_attachments')
    .select('id, display_name, company_id')
    .eq('access_token', token)
    .maybeSingle();
  if (standalone) {
    return {
      scope: 'standalone',
      companyId: standalone.company_id,
      rows: [{ id: standalone.id, displayName: standalone.display_name }],
    };
  }

  return null;
}

/**
 * Authorise a single download: validate token, ensure the requested
 * attachment row is reachable through that token, and re-derive the live
 * storage path. `fileId` is the message_attachments row id (required for
 * quote/order context; ignored for standalone where the token already
 * identifies the single row).
 */
export async function authorizeAttachmentDownload(
  token: string,
  fileId: string | null,
): Promise<ResolvedDownload | null> {
  if (!isUuid(token)) return null;
  const admin = createAdminClient();

  // Standalone: token directly identifies the row.
  const { data: standalone } = await admin
    .from('message_attachments')
    .select(ATTACHMENT_COLUMNS)
    .eq('access_token', token)
    .maybeSingle();
  if (standalone) {
    return resolveSourceFile(admin, standalone as AttachmentRowShape);
  }

  // Quote / order context requires a specific file id scoped to the token.
  if (!isUuid(fileId)) return null;

  const { data: quote } = await admin
    .from('quotes')
    .select('id')
    .eq('acceptance_token', token)
    .maybeSingle();
  if (quote) {
    const { data: row } = await admin
      .from('message_attachments')
      .select(ATTACHMENT_COLUMNS)
      .eq('id', fileId as string)
      .eq('quote_id', quote.id)
      .maybeSingle();
    if (!row) return null;
    return resolveSourceFile(admin, row as AttachmentRowShape);
  }

  const { data: order } = await admin
    .from('material_orders')
    .select('id')
    .eq('acceptance_token', token)
    .maybeSingle();
  if (order) {
    const { data: row } = await admin
      .from('message_attachments')
      .select(ATTACHMENT_COLUMNS)
      .eq('id', fileId as string)
      .eq('order_id', order.id)
      .maybeSingle();
    if (!row) return null;
    return resolveSourceFile(admin, row as AttachmentRowShape);
  }

  return null;
}
