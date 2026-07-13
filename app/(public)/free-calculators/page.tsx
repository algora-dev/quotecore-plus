import { TRADE_CALCULATORS, HUB_BLURBS } from './configs/registry';
import { ROOFING_SLUG_CONFIGS } from './configs/roofingSlugRegistry';
import { CONCRETE_SLUG_CONFIGS } from './configs/concreteSlugs';
import { CONSTRUCTION_SLUG_CONFIGS } from './configs/constructionSlugs';
import { SLOPE_SLUG_CONFIGS } from './configs/slopeSlugs';
import { CalculatorHubClient, type CalculatorEntry, type FreeToolEntry } from './_shared/CalculatorHubClient';

/**
 * Hub page for all free calculators.
 * Server component - builds the full calculator list and passes to the
 * client component for search/filter interactivity.
 *
 * SEO: All calculator links are server-rendered in the HTML (Next.js SSG
 * pre-renders client components at build time). Each slug page is independently
 * crawlable via its own route and included in the sitemap.
 */
export default function Page() {
  const coreSlugs = new Set(TRADE_CALCULATORS.map((c) => c.slug));

  // Determine category for the 5 core calculators
  const coreCategory = (slug: string): CalculatorEntry['category'] => {
    if (slug === 'free-roofing-calculator' || slug === 'free-birds-mouth-calculator') return 'roofing';
    if (slug === 'free-construction-calculator') return 'construction';
    if (slug === 'free-concrete-calculator') return 'concrete';
    if (slug === 'free-landscaping-calculator') return 'landscaping';
    return 'roofing';
  };

  // Build the full unified list (all calculators, all categories)
  const calculators: CalculatorEntry[] = [
    // 5 core calculators
    ...TRADE_CALCULATORS.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: HUB_BLURBS[c.slug] ?? c.metaDescription,
      category: coreCategory(c.slug),
      isCore: true,
    })),
    // Roofing SEO slug pages
    ...ROOFING_SLUG_CONFIGS.filter((c) => !coreSlugs.has(c.slug)).map((c) => ({
      slug: c.slug,
      name: c.content.h1,
      description: c.metaDescription,
      category: 'roofing' as const,
      isCore: false,
    })),
    // Concrete SEO slug pages
    ...CONCRETE_SLUG_CONFIGS.filter((c) => !coreSlugs.has(c.slug)).map((c) => ({
      slug: c.slug,
      name: c.content.h1,
      description: c.metaDescription,
      category: 'concrete' as const,
      isCore: false,
    })),
    // Construction SEO slug pages
    ...CONSTRUCTION_SLUG_CONFIGS.filter((c) => !coreSlugs.has(c.slug)).map((c) => ({
      slug: c.slug,
      name: c.content.h1,
      description: c.metaDescription,
      category: 'construction' as const,
      isCore: false,
    })),
    // Slope SEO slug pages
    ...SLOPE_SLUG_CONFIGS.filter((c) => !coreSlugs.has(c.slug)).map((c) => ({
      slug: c.slug,
      name: c.content.h1,
      description: c.metaDescription,
      category: 'slope' as const,
      isCore: false,
    })),
  ];

  const freeTools: FreeToolEntry[] = [
    {
      slug: 'free-quote-generator',
      name: 'Free Quote Generator',
      description: 'Turn measurements into a professional quote',
    },
    {
      slug: 'free-invoice-generator',
      name: 'Free Invoice Generator',
      description: 'Create and send professional invoices',
    },
    {
      slug: 'free-purchase-order-generator',
      name: 'Free Purchase Order Generator',
      description: 'Create supplier order forms from your calculations',
    },
  ];

  return <CalculatorHubClient calculators={calculators} freeTools={freeTools} />;
}
