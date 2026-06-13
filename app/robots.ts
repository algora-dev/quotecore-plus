import type { MetadataRoute } from 'next';

/**
 * robots.txt - allow indexing of public marketing/docs/legal pages, block
 * everything behind auth or auto-generated workspace URLs. Sitemap points
 * to `/sitemap.xml` (served by `app/sitemap.ts`).
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://quote-core.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/docs', '/privacy', '/cookies', '/terms', '/login', '/signup'],
        disallow: [
          '/api/',
          '/auth/',
          '/onboarding',
          '/2fa',
          '/accept/',          // signed acceptance links, never indexable
          '/admin',
          // Workspace-scoped authed routes - anything that looks like /<slug>/...
          // is gated by middleware; we mirror that in robots to keep crawlers off.
          '/*/quotes',
          '/*/customers',
          '/*/settings',
          '/*/resources',
          '/*/templates',
          '/*/material-orders',
          '/*/jobs',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
