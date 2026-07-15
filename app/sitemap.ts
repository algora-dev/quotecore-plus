import type { MetadataRoute } from 'next';
import { getPublishedSlugs } from '@/app/lib/docs/tree';
import { ROOFING_SLUGS } from '@/app/(public)/free-calculators/configs/roofingSlugRegistry';
import { CONCRETE_SLUGS } from '@/app/(public)/free-calculators/configs/concreteSlugs';
import { CONSTRUCTION_SLUGS } from '@/app/(public)/free-calculators/configs/constructionSlugs';
import { SLOPE_SLUGS } from '@/app/(public)/free-calculators/configs/slopeSlugs';
import { BLOG_POSTS } from '@/app/lib/blog-posts';

/**
 * Public sitemap for https://quote-core.com.
 *
 * Only includes canonical, indexable, HTTP-200 pages on the global site.
 * No app.quote-core.com URLs, no redirects, no noindex pages.
 *
 * Doc pages are pulled from the same tree used to render `/docs`, so a new
 * doc lands in the sitemap automatically the next time the site builds.
 * Blog posts come from the shared `BLOG_POSTS` array in `app/lib/blog-posts.ts`
 * which is also used by the blog page itself — single source of truth.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://quote-core.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/roofing-quoting-software`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/construction-quoting-software`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/services`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/free-trial`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    // Docs
    { url: `${SITE_URL}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    // Free tools hub
    { url: `${SITE_URL}/free-calculators`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    // Main trade calculators
    { url: `${SITE_URL}/free-roofing-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-construction-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-concrete-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-landscaping-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-birds-mouth-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    // Free document generators
    { url: `${SITE_URL}/free-quote-generator`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-purchase-order-generator`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-invoice-generator`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
  ];

  // Blog posts (from shared source)
  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.lastModified),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // SEO slug pages
  const slugEntries: MetadataRoute.Sitemap = [
    ...ROOFING_SLUGS.map((slug) => ({
      url: `${SITE_URL}/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...CONCRETE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/${slug.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...CONSTRUCTION_SLUGS.map((slug) => ({
      url: `${SITE_URL}/${slug.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...SLOPE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/${slug.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];

  // Doc pages (excluding coming-soon)
  const docEntries: MetadataRoute.Sitemap = getPublishedSlugs()
    .filter((s) => s !== '')
    .map((slug) => ({
      url: `${SITE_URL}/docs/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }));

  return [...staticEntries, ...blogEntries, ...slugEntries, ...docEntries];
}
