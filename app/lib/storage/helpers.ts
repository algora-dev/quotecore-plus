import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Build a service-role Supabase client purely for storage signing.
 *
 * Re-creating this per call is cheap (it is just a thin wrapper), and keeps
 * us from leaking the service-role client out into other modules. Storage
 * signing has to bypass RLS on `storage.objects` for now because object
 * ownership is keyed on path prefix, not row metadata.
 */
function getStorageAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Get a signed URL for private storage files.
 * Use this for the QUOTE-DOCUMENTS bucket (private).
 *
 * Default expiry is 1 hour; pages that re-render frequently always mint a
 * fresh URL, so 1 hour is plenty for view sessions and short enough that
 * leaked URLs become useless quickly.
 */
export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string> {
  const supabase = getStorageAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  return data.signedUrl;
}

/**
 * Batch variant. Single API round-trip for many paths, which matters on
 * pages that render five-to-twenty file thumbnails or download links.
 *
 * Returns one entry per input path, in the same order. If an individual
 * path fails to sign (e.g. file missing), its `signedUrl` is null and
 * `error` carries the reason. The function does not throw on partial
 * failures - callers can render placeholders for nulls.
 */
export async function getSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn: number = 3600,
): Promise<Array<{ path: string; signedUrl: string | null; error: string | null }>> {
  if (paths.length === 0) return [];
  const supabase = getStorageAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error) {
    // Whole-batch failure: surface so the caller can decide whether to
    // continue with placeholders or bubble it up.
    throw new Error(`Failed to create signed URLs: ${error.message}`);
  }
  // The Supabase response is parallel by index but the `path` field on each
  // entry is authoritative - use it so the caller does not have to trust
  // ordering.
  return (data ?? []).map((entry) => ({
    path: entry.path ?? '',
    signedUrl: entry.signedUrl ?? null,
    error: entry.error ?? null,
  }));
}

/**
 * Download a private storage object's raw bytes as a Buffer.
 *
 * Used by the email-attachment builder, which needs the actual file content
 * (not a URL) to hand to Resend. Goes through the service-role client because
 * email sending happens in server contexts where object ownership is enforced
 * by the caller (the caller has already verified the file belongs to the
 * company/quote before asking us to attach it).
 *
 * Throws on failure so the caller can decide whether to skip the attachment
 * or abort the whole send.
 */
export async function downloadStorageObject(bucket: string, path: string): Promise<Buffer> {
  const supabase = getStorageAdminClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Failed to download storage object ${path}: ${error?.message ?? 'no data'}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
