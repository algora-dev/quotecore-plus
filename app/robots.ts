import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site-url';

/**
 * robots.txt for https://quote-core.com.
 *
 * Production: allows crawling of all public pages, blocks only private/app routes.
 * Preview/staging: blocks all crawling (noindex everything).
 *
 * Sitemap points to the global sitemap only.
 * The NZ site (quote-core.co.nz) has its own robots.txt + sitemap.
 */

const isProduction = process.env.VERCEL_ENV === 'production' || !process.env.VERCEL_ENV;

export default function robots(): MetadataRoute.Robots {
  // Preview/staging: block everything
  if (!isProduction) {
    return {
      rules: { userAgent: '*', disallow: '/' },
      sitemap: `${SITE_URL}/sitemap.xml`,
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
      ],
      disallow: [
        '/api/',
        '/auth/',
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
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
