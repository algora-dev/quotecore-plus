import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { canonicalOrigin } from '@/lib/seo/dual-domain';

/**
 * robots.txt - domain-aware.
 *
 * quote-core.com: allows crawling of all public pages, blocks private/app routes.
 * quote-core.co.nz: same rules, but sitemap + host point to .co.nz.
 * Preview/staging: blocks all crawling (noindex everything).
 */

const isProduction = process.env.VERCEL_ENV === 'production' || !process.env.VERCEL_ENV;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get('host') || '';
  const origin = canonicalOrigin(host);

  // Preview/staging: block everything
  if (!isProduction) {
    return {
      rules: { userAgent: '*', disallow: '/' },
      sitemap: `${origin}/sitemap.xml`,
    };
  }

  // Production: allow everything EXCEPT private/auth/api routes
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/free-tools',
        '/free-calculators',
        '/free-roofing-calculator',
        '/free-construction-calculator',
        '/free-concrete-calculator',
        '/free-landscaping-calculator',
        '/free-birds-mouth-calculator',
        '/free-quote-generator',
        '/free-invoice-generator',
        '/free-purchase-order-generator',
        '/free-roofing-takeoff-builder',
        '/docs/components',
        '/docs/attachments',
        '/docs/templates',
        '/docs/material-orders',
        '/docs/account',
        '/docs/concepts',
      ],
      disallow: [
        '/api/',
        '/auth/',
        // Supplier catalogue data files (machine-readable, no search value; GSC 404 noise)
        '/*catalogue.csv',
        '/*catalogue.json',
        '/onboarding',
        '/2fa',
        '/accept/',
        '/admin',
        '/login',
        '/signup',
        // Workspace-scoped authed routes - gated by middleware
        '/*/quotes',
        '/*/customers',
        '/*/settings',
        '/*/resources',
        '/*/templates',
        '/*/material-orders',
        '/*/jobs',
        '/*/components',
        '/*/drawings',
        '/*/catalogs',
        '/*/attachments',
        '/*/inbox',
        '/*/account',
      ],
    },
    sitemap: [`${origin}/sitemap.xml`, `${origin}/video-sitemap.xml`],
    host: origin,
  };
}
