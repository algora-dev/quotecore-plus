import type { MetadataRoute } from 'next';
import { getAllSlugs } from '@/app/lib/docs/tree';
import { ROOFING_SLUGS } from '@/app/(public)/free-calculators/configs/roofingSlugRegistry';

/**
 * Public sitemap. Only includes pages that don't require auth, since the
 * rest of the app is behind login and won't be indexable anyway.
 *
 * Doc pages are pulled from the same tree used to render `/docs`, so a new
 * doc lands in the sitemap automatically the next time the site builds.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://quote-core.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const today = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: today, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/login`, lastModified: today, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/signup`, lastModified: today, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: today, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/cookies`, lastModified: today, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: today, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/docs`, lastModified: today, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/free-calculators`, lastModified: today, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/free-construction-calculator`, lastModified: today, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-roofing-calculator`, lastModified: today, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-concrete-calculator`, lastModified: today, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-landscaping-calculator`, lastModified: today, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-birds-mouth-calculator`, lastModified: today, changeFrequency: 'monthly', priority: 0.9 },
    ...ROOFING_SLUGS.map((slug) => ({
      url: `${SITE_URL}/${slug}`,
      lastModified: today,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/free-quote-generator`, lastModified: today, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-purchase-order-generator`, lastModified: today, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-invoice-generator`, lastModified: today, changeFrequency: 'monthly', priority: 0.9 },
  ];

  const docEntries: MetadataRoute.Sitemap = getAllSlugs()
    .filter((s) => s !== '') // index already listed above
    .map((slug) => ({
      url: `${SITE_URL}/docs/${slug}`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.5,
    }));

  return [...staticEntries, ...docEntries];
}
