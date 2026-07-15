/**
 * Canonical production URL for the global site.
 *
 * `NEXT_PUBLIC_SITE_URL` on Vercel may point to `app.quote-core.com`
 * (the app domain). The sitemap, robots.txt, and metadataBase must
 * always use the canonical marketing domain `quote-core.com` in
 * production so Google indexes the right URLs.
 *
 * Preview/dev builds fall back to the env var (or the Vercel preview URL).
 */
export const PRODUCTION_URL = 'https://quote-core.com';

export const SITE_URL =
  process.env.VERCEL_ENV === 'production'
    ? PRODUCTION_URL
    : process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || PRODUCTION_URL;
