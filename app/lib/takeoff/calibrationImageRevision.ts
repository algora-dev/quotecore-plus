// Server-only image revision helper (P4, spec 5.3 + baseline section 6).
// Produces a stable revision string for a takeoff page's immutable source
// image: sha256(content) truncated + orientation-normalisation version.
// NOT a signed URL (a refreshed token does not change image content).
//
// Server-side only: imports the Supabase server client (user session) and
// Node crypto. Any failure resolves to null - the calibration UI treats a
// null revision as "unavailable", never as an error.
import { createHash } from 'node:crypto';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { BUCKETS } from '@/app/lib/storage/buckets';

/** Bumped when the orientation-normalisation pipeline changes. */
export const ORIENTATION_NORMALISATION_VERSION = 'on1';

const DIGEST_HEX_CHARS = 16;

/** In-process cache keyed by storage object path. Paths change on re-upload
 *  (canonical reference per baseline 6), so path is a sufficient cache key;
 *  in-place object replacement at the same path is not a supported flow and
 *  would be caught by the digest changing after a process restart. */
const revisionCache = new Map<string, string>();

/**
 * Resolve the immutable source-image revision for a takeoff page.
 * Returns null when the page/image cannot be resolved (never throws).
 */
export async function getCalibrationImageRevision(
  pageId: string,
): Promise<string | null> {
  try {
    if (!pageId) return null;
    const supabase = await createSupabaseServerClient();

    const { data: page, error: pageError } = await supabase
      .from('takeoff_pages')
      .select('image_storage_path')
      .eq('id', pageId)
      .maybeSingle();
    if (pageError || !page) return null;

    const path = (page as { image_storage_path?: string | null; quote_id?: string }).image_storage_path
      ?? null;
    // Page-1 fallback: the first plan page stores its image in the quote's
    // uploaded plan files, not takeoff_pages.image_storage_path (known app
    // convention since 2026-07-06). Resolve the OLDEST plan file.
    if (!path) {
      const quoteId = (page as { quote_id?: string }).quote_id;
      if (!quoteId) return null;
      const { data: firstPlan, error: planErr } = await supabase
        .from('quote_files')
        .select('storage_path')
        .eq('quote_id', quoteId)
        .eq('file_type', 'plan')
        .order('uploaded_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (planErr || !firstPlan) return null;
      const planPath = (firstPlan as { storage_path?: string | null }).storage_path;
      if (!planPath) return null;
      return revisionForPath(planPath);
    }
    return revisionForPath(path);
  } catch {
    // Graceful degradation: calibration treats null as unavailable.
    return null;
  }
}

/** Compute (and cache) the content revision for a resolved storage path. */
async function revisionForPath(path: string): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const cached = revisionCache.get(path);
    if (cached) return cached;

    const { data: blob, error: dlError } = await supabase.storage
      .from(BUCKETS.QUOTE_DOCUMENTS)
      .download(path);
    if (dlError || !blob) return null;

    const buf = Buffer.from(await blob.arrayBuffer());
    const digest = createHash('sha256').update(buf).digest('hex').slice(0, DIGEST_HEX_CHARS);
    const revision = `sha256-${digest}-${ORIENTATION_NORMALISATION_VERSION}`;
    revisionCache.set(path, revision);
    return revision;
  } catch {
    return null;
  }
}
