import type { MetadataRoute } from 'next';
import { getPublishedSlugs } from '@/app/lib/docs/tree';
import { ROOFING_SLUGS } from '@/app/(public)/free-calculators/configs/roofingSlugRegistry';
import { CONCRETE_SLUGS } from '@/app/(public)/free-calculators/configs/concreteSlugs';
import { CONSTRUCTION_SLUGS } from '@/app/(public)/free-calculators/configs/constructionSlugs';
import { SLOPE_SLUGS } from '@/app/(public)/free-calculators/configs/slopeSlugs';
import { getSitemapPosts } from '@/app/lib/blog-posts';
import { SITE_URL } from '@/lib/seo/site-url';
import { getSupplierDirectory, TEST_SUPPLIER_SLUGS } from '@/lib/supplier-directory';

/**
 * Public sitemap for https://quote-core.com.
 *
 * Only includes canonical, indexable, HTTP-200 pages on the global site.
 * No app.quote-core.com URLs, no redirects, no noindex pages.
 *
 * Doc pages are pulled from the same tree used to render `/docs`, so a new
 * doc lands in the sitemap automatically the next time the site builds.
 * Blog posts come from the shared `BLOG_POSTS` array in `app/lib/blog-posts.ts`
 * which is also used by the blog page itself - single source of truth.
 */

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/roofing-quoting-software`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/roofing-estimating-software`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/roofing-takeoff-software`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/construction-quoting-software`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/roofsnap-alternative`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/eagleview-alternative`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/planswift-alternative`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/roofr-alternative`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/stack-alternative-for-roofing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/hover-alternative`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/bluebeam-alternative-for-roofing`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/roof-measurement-cost-comparison`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/affiliate-program`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/affiliate-program-terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/services`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/company`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/features`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/features/digital-roof-takeoff`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/features/ai-scan-assist`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/features/smart-components`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/features/sending-and-tracking`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/features/material-ordering`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/features/invoicing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/features/supplier-resources`, changeFrequency: 'monthly', priority: 0.8 },
    // Interactive takeoff demo
    { url: `${SITE_URL}/takeoff-demo`, changeFrequency: 'monthly', priority: 0.8 },
    // Free roof takeoff tool (upload your own plan)
    { url: `${SITE_URL}/free-roof-takeoff`, changeFrequency: 'monthly', priority: 0.8 },
    // Resource hubs
    { url: `${SITE_URL}/resources/roofing-estimating`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/resources/construction-quoting`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/resources/digital-takeoffs`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/resources/contractor-business`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/resources/quotecore-guides`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/resources/comparisons`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/resources/ai`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/tutorials`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/free-trial`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/suppliers`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/suppliers-info`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/trust`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/customer-stories`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/cookie-policy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    // Docs
    { url: `${SITE_URL}/docs`, changeFrequency: 'weekly', priority: 0.7 },
    // Free tools hub
    { url: `${SITE_URL}/free-tools`, changeFrequency: 'weekly', priority: 0.9 },
    // Free calculators hub (category page)
    { url: `${SITE_URL}/free-calculators`, changeFrequency: 'weekly', priority: 0.8 },
    // Main trade calculators
    { url: `${SITE_URL}/free-roofing-calculator`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-construction-calculator`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-concrete-calculator`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-landscaping-calculator`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-birds-mouth-calculator`, changeFrequency: 'monthly', priority: 0.9 },
    // Free document generators
    { url: `${SITE_URL}/free-quote-generator`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-margin-calculator`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-purchase-order-generator`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/free-invoice-generator`, changeFrequency: 'monthly', priority: 0.9 },
    // Roof takeoff builder (standalone tool, not part of slug system)
    { url: `${SITE_URL}/free-roofing-takeoff-builder`, changeFrequency: 'monthly', priority: 0.9 },
    // Free quote builder (smart components + manual measurements)
    { url: `${SITE_URL}/measurement-to-quote-tool`, changeFrequency: 'monthly', priority: 0.9 },
    // Supplier-specific takeoff builder pages are noindex — excluded from sitemap
    // Roof pricing calculator (component-based pricing page)
    { url: `${SITE_URL}/free-roof-pricing-calculator`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/docs/roof-takeoff-api`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/docs/roof-takeoff-calculate`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  // Blog posts (from shared source, excludes drafts)
  const blogEntries: MetadataRoute.Sitemap = getSitemapPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.lastModified),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // SEO slug pages
  const slugEntries: MetadataRoute.Sitemap = [
    ...ROOFING_SLUGS.map((slug) => ({
      url: `${SITE_URL}/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...CONCRETE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/${slug.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...CONSTRUCTION_SLUGS.map((slug) => ({
      url: `${SITE_URL}/${slug.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...SLOPE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/${slug.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];

  // Doc pages (excluding coming-soon)
  const docEntries: MetadataRoute.Sitemap = getPublishedSlugs()
    .filter((s) => s !== '')
    .map((slug) => ({
      url: `${SITE_URL}/docs/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }));

  // Supplier pages (dynamic, from public_supplier_directory RPC)
  // Only HTML profile and catalogue pages are included — CSV/JSON data
  // exports and versioned catalogue routes are excluded (non-indexable).
  // Test supplier accounts are excluded (noindex) — they exist for
  // demo/Takeoff Builder purposes, not search (Tom brief 2026-08-20).
  const suppliers = await getSupplierDirectory();
  const supplierEntries: MetadataRoute.Sitemap = [];
  for (const s of suppliers) {
    if (!s.slug) continue;
    if (TEST_SUPPLIER_SLUGS.has(s.slug)) continue;
    supplierEntries.push({
      url: `${SITE_URL}/suppliers/${s.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    });
    // HTML catalogue page (indexable)
    supplierEntries.push({
      url: `${SITE_URL}/suppliers/${s.slug}/catalogue`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    });
  }

  return [...staticEntries, ...blogEntries, ...slugEntries, ...docEntries, ...supplierEntries];
}
