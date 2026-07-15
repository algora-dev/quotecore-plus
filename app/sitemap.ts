import type { MetadataRoute } from 'next';
import { getAllSlugs } from '@/app/lib/docs/tree';
import { ROOFING_SLUGS } from '@/app/(public)/free-calculators/configs/roofingSlugRegistry';
import { CONCRETE_SLUGS } from '@/app/(public)/free-calculators/configs/concreteSlugs';
import { CONSTRUCTION_SLUGS } from '@/app/(public)/free-calculators/configs/constructionSlugs';
import { SLOPE_SLUGS } from '@/app/(public)/free-calculators/configs/slopeSlugs';

/**
 * Public sitemap for https://quote-core.com.
 *
 * Only includes canonical, indexable, HTTP-200 pages on the global site.
 * No app.quote-core.com URLs, no redirects, no noindex pages.
 *
 * Doc pages are pulled from the same tree used to render `/docs`, so a new
 * doc lands in the sitemap automatically the next time the site builds.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://quote-core.com';

// Blog post slugs — kept in sync with app/(marketing)/blog/[slug]/page.tsx
const BLOG_POSTS = [
  { slug: 'best-roofing-quoting-software-uk-2026', lastmod: '2026-06-15' },
  { slug: 'how-to-get-more-work-as-a-contractor', lastmod: '2026-06-13' },
  { slug: 'construction-quote-speed-checklist', lastmod: '2026-06-05' },
  { slug: 'quotecore-plus-reviews', lastmod: '2026-05-27' },
  { slug: 'quotecore-plus-vs-quotesmith', lastmod: '2026-05-23' },
  { slug: 'roofing-quoting-software-vs-spreadsheets', lastmod: '2026-05-11' },
  { slug: 'roofing-quoting-software-uk', lastmod: '2026-05-06' },
  { slug: 'built-by-a-roofer', lastmod: '2026-05-06' },
];

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

  // Blog posts
  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.lastmod),
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

  // Doc pages
  const docEntries: MetadataRoute.Sitemap = getAllSlugs()
    .filter((s) => s !== '')
    .map((slug) => ({
      url: `${SITE_URL}/docs/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }));

  return [...staticEntries, ...blogEntries, ...slugEntries, ...docEntries];
}
