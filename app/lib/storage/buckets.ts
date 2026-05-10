/**
 * Canonical Supabase Storage bucket names.
 *
 * Always import from here instead of hardcoding bucket strings, so a future
 * rename or environment-specific override only needs to change in one place.
 *
 * Privacy:
 *  - QUOTE_DOCUMENTS is PRIVATE. Always use signed URLs from
 *    `app/lib/storage/helpers.ts` (`getSignedUrl` / `getSignedUrls`) to read.
 *  - COMPANY_LOGOS is intentionally PUBLIC. Logos appear on customer-facing
 *    quotes and are not sensitive, so `getPublicUrl()` is fine for that bucket.
 */
export const BUCKETS = {
  QUOTE_DOCUMENTS: 'QUOTE-DOCUMENTS',
  COMPANY_LOGOS: 'company-logos',
} as const;

export type BucketName = typeof BUCKETS[keyof typeof BUCKETS];
