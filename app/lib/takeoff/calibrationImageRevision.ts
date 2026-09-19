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

    const path = (page as { image_storage_path?: string | null }).image_storage_path;
    if (!path || typeof path !== 'string') return null;

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
    // Graceful degradation: calibration treats null as unavailable.
    return null;
  }
}
