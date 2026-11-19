import 'server-only';
import sharp from 'sharp';
import type { createAdminClient } from '@/app/lib/supabase/admin';
import { BUCKETS } from '@/app/lib/storage/buckets';

/**
 * Job-list plan thumbnails (owner 2026-11-19).
 *
 * Small JPEG previews of plan images, stored next to the plan in the private
 * QUOTE-DOCUMENTS bucket under a thumbs/ prefix. The Job Spaces list shows the
 * thumbnail of the FIRST plan ever uploaded to each job (earliest created_at
 * on quote_files where file_type='plan').
 *
 * Generation is always NON-FATAL to the upload flow: on any failure the row
 * keeps a NULL thumb_path and the list renders the placeholder instead.
 */

const THUMB_WIDTH = 240;

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

/** Image mimes sharp can handle. SVG excluded (unsafe rasterisation surface). */
export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/') && mime !== 'image/svg+xml';
}

/** {company}/{quote}/plan-123.png -> {company}/{quote}/thumbs/plan-123.jpg */
export function planThumbPath(storagePath: string): string {
  const lastSlash = storagePath.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : storagePath.slice(0, lastSlash);
  const base = lastSlash === -1 ? storagePath : storagePath.slice(lastSlash + 1);
  const stem = base.replace(/\.[^.]+$/, '') || base;
  return `${dir ? `${dir}/` : ''}thumbs/${stem}.jpg`;
}

/** Render a small JPEG preview. Returns null on any decode/encode failure. */
export async function renderPlanThumbnail(input: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(input, { failOn: 'none' })
      .rotate() // respect EXIF orientation from phone photos
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
  } catch (err) {
    console.error('[plan-thumbnail] render failed:', err);
    return null;
  }
}

/** Upload the rendered thumb (upsert) and return its storage path, or null. */
export async function uploadPlanThumbnail(
  admin: AdminClient,
  storagePath: string,
  thumb: Buffer,
): Promise<string | null> {
  const thumbPath = planThumbPath(storagePath);
  const { error } = await admin.storage
    .from(BUCKETS.QUOTE_DOCUMENTS)
    .upload(thumbPath, thumb, { contentType: 'image/jpeg', upsert: true });
  if (error) {
    console.error('[plan-thumbnail] upload failed:', error.message);
    return null;
  }
  return thumbPath;
}
