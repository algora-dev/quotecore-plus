/**
 * Single source of truth for blog post metadata.
 *
 * Used by:
 *   - app/(marketing)/blog/[slug]/page.tsx  (renders posts)
 *   - app/sitemap.ts                         (includes posts in sitemap)
 *
 * The content imports stay in page.tsx because they use dynamic import()
 * which is page-specific. This file only holds the metadata needed by both
 * consumers: slug, title, description, date, lastModified.
 */

export type BlogCategory =
  | 'roofing-estimating'
  | 'construction-quoting'
  | 'digital-takeoffs'
  | 'contractor-business'
  | 'quotecore-guides'
  | 'comparisons'
  | 'ai';

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;        // ISO date (datePublished)
  lastModified: string; // ISO date for sitemap
  draft?: boolean;     // if true, hidden from index, noindex, excluded from sitemap
  category?: BlogCategory; // primary topic for resource hubs
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: 'quotecore-plus-reviews',
    category: 'comparisons',
    title: 'QuoteCore+ Reviews: Is It Legit and Who Is It For?',
    description:
      'Wondering if QuoteCore+ is legit? Here\u2019s what the platform does, who it is for, how the free trial works, and how it helps construction businesses manage the workflow from quote to material orders, job management and invoicing.',
    date: '2026-05-27',
    lastModified: '2026-05-27',
  },
  {
    slug: 'quotecore-plus-vs-quotesmith',
    category: 'comparisons',
    title: 'QuoteCore+ vs QuoteSmith: Full Quote Workflow',
    description:
      'QuoteSmith and QuoteCore+ both help trades create better quotes, but they solve different problems. One focuses on proposal writing, the other on the workflow from measurement to quote, material orders, job management and invoicing.',
    date: '2026-05-23',
    lastModified: '2026-05-23',
  },
  {
    slug: 'roofing-quoting-software-uk',
    category: 'comparisons',
    title: 'How UK Roofing Contractors Are Getting Quotes Out Faster',
    description:
      'Many UK roofing businesses lose time after the site visit, when notes, photos, pricing and material details have to be pulled together manually. Here\u2019s how a better quote workflow helps.',
    date: '2026-05-06',
    lastModified: '2026-05-06',
  },
  {
    slug: 'roofing-quoting-software-vs-spreadsheets',
    category: 'comparisons',
    title: 'Roofing Quoting Software vs Spreadsheets: What Saves Time?',
    description:
      'Spreadsheets can work for roofing quotes, but they start to slow businesses down when measurements, pricing, approvals, material orders, job details and invoicing need to stay connected.',
    date: '2026-05-11',
    lastModified: '2026-05-11',
  },
  {
    slug: 'built-by-a-roofer',
    category: 'quotecore-guides',
    title: 'Built From Roofing Experience: The Story Behind QuoteCore+',
    description:
      'QuoteCore+ was shaped by real roofing and construction experience, with Shaun leading the product direction around the quoting and job workflow problems trades businesses deal with every day.',
    date: '2026-05-06',
    lastModified: '2026-05-06',
  },
  {
    slug: 'construction-quote-speed-checklist',
    category: 'construction-quoting',
    title: 'The Construction Quote Speed Checklist',
    description:
      'A practical checklist for construction businesses that want to send quotes faster without rushing the numbers or losing track of job details.',
    date: '2026-06-05',
    lastModified: '2026-06-05',
  },
  {
    slug: 'how-to-get-more-work-as-a-contractor',
    category: 'contractor-business',
    title: 'Get More Work as a Contractor: 7 Things to Fix First',
    description:
      'Most contractors don\u2019t struggle because they\u2019re bad at the work - they struggle because getting work is left to chance. Here are 7 things to fix first, plus a free weekly checklist.',
    date: '2026-06-13',
    lastModified: '2026-06-13',
  },
  {
    slug: 'best-quoting-software-nz',
    category: 'comparisons',
    title: 'Best Quoting Software for NZ Builders & Tradies (2026)',
    description:
      'Looking for quoting software in NZ? We compared 6 platforms on pricing, features, GST support, and NZ-specific tools. See which fits your trade.',
    date: '2026-07-15',
    lastModified: '2026-08-05',
  },
  {
    slug: 'best-quoting-software-au',
    category: 'comparisons',
    title: 'Best Quoting Software for Australian Tradies (2026)',
    description:
      'Compare the best quoting software for Australian builders and trades. Features, pricing in AUD, GST support, and AU-specific tools for roofers, builders, and contractors.',
    date: '2026-08-05',
    lastModified: '2026-08-05',
  },
  {
    slug: 'best-quoting-software-us',
    category: 'comparisons',
    title: 'Best Quoting Software for US Contractors (2026)',
    description:
      'Compare the best quoting software for US contractors. Features, pricing in USD, and trade-specific tools for roofers, builders, and home service businesses.',
    date: '2026-08-05',
    lastModified: '2026-08-05',
  },
  {
    slug: 'best-roofing-quoting-software-uk-2026',
    category: 'comparisons',
    title: 'Best Roofing Quoting Software UK (2026)',
    description:
      'Comparing the best roofing quoting software available to UK contractors in 2026. Honest breakdown of QuoteCore+, Sleepless Tradesman, Tradify, Jobber, Powered Now, Fergus, and EasyEstimate - with a comparison table and recommendations by business type.',
    date: '2026-06-15',
    lastModified: '2026-06-15',
  },
  {
    slug: 'how-to-calculate-roof-pitch',
    category: 'roofing-estimating',
    title: 'How to Calculate Roof Pitch for Your Quote',
    description:
      'Complete guide to roof pitch: what it is, the three ways it gets expressed (degrees, ratio, percentage), how to calculate it from measurements, common mistakes, and free tools that do the maths for you.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-to-measure-a-roof',
    category: 'roofing-estimating',
    title: 'How to Measure a Roof for Materials (Complete Guide)',
    description:
      'Three ways to measure a roof (site visit, plans, digital takeoff), how to calculate actual surface area from plan dimensions with pitch factors, and free tools that handle the maths for you.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-much-roofing-material',
    category: 'roofing-estimating',
    title: 'How Much Roofing Material Do You Need? Guide',
    description:
      'How to calculate tile, underlay, batten, and fixing quantities for any roofing job. Real coverage rates, waste allowances by roof type, and free tools that do the calculation for you.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-to-price-a-roofing-job',
    category: 'roofing-estimating',
    title: 'How to Price a Roofing Job: Step-by-Step Pricing Guide',
    description:
      'Complete roofing pricing guide with worked example. Covers materials, labour, scaffold, disposal, overhead, profit margin, common pricing mistakes, and how to present your price professionally.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'best-free-tools-for-roofers',
    category: 'quotecore-guides',
    title: 'Best Free Tools for Roofers and Contractors (2026)',
    description:
      'Complete list of the best free roofing and construction tools: takeoff builder, pitch calculator, area calculator, material calculator, quote generator, invoice generator, and 30+ specialised calculators. All free, no signup.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-to-do-a-roof-takeoff',
    category: 'digital-takeoffs',
    title: 'How to Do a Roof Takeoff: Complete Step-by-Step Guide',
    description:
      'Complete roof takeoff guide: measure roof area from plans, calculate pitch-adjusted quantities, separate roof planes and linear components, apply waste, and produce a material order. With free tools and video walkthroughs.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'roofing-material-list',
    category: 'roofing-estimating',
    title: 'Roofing Material List: What You Need for Every Roof Type',
    description:
      'Complete roofing material list for every roof type: tiles, slates, shingles, metal sheets, flat roofs, and membranes. Covers underlay, battens, fixings, flashings, gutters, and accessories with free calculators for each.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'how-to-create-an-invoice-for-contractors',
    category: 'construction-quoting',
    title: 'How to Create an Invoice: Free Guide for Contractors',
    description:
      'Step-by-step invoice guide for contractors: what to include, how to number invoices, describe work clearly, calculate tax, set payment terms, handle variations, and avoid common mistakes. With free invoice generator.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'how-to-send-a-purchase-order',
    category: 'construction-quoting',
    title: 'How to Send a Purchase Order to a Supplier',
    description:
      'Complete purchase order guide for contractors: what a PO includes, how to number and send it, avoid common mistakes, and connect quotes to material ordering. With free purchase order generator.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'roofing-waste-calculation',
    category: 'roofing-estimating',
    title: 'Roofing Waste Calculation: How Much Extra Material to Order',
    description:
      'How to calculate roofing waste allowances by material type, roof complexity, and product format. Covers net vs gross vs order quantities, linear materials, fixings, and common mistakes. With free waste calculator.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'construction-cost-estimator-guide',
    category: 'construction-quoting',
    title: 'Construction Cost Estimator: How to Budget Any Project',
    description:
      'Complete construction cost estimating guide: scope definition, quantity measurement, material pricing, labour estimation, subcontractors, overheads, risk, and margin. With free construction and concrete calculators.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'roof-replacement-cost-guide-uk',
    category: 'roofing-estimating',
    title: 'Roof Replacement Cost Guide: UK Estimate',
    description:
      'How to build an accurate roof replacement cost estimate in the UK: factors that drive cost, material price ranges, labour and access, stripping and disposal, and how to present a replacement quote professionally.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'reusable-quoting-templates-smart-components',
    category: 'quotecore-guides',
    title: 'Reusable Quoting Templates: Smart Components',
    description:
      'How to build reusable quoting templates with Smart Components: choose repeatable work units, define inputs, add materials, build calculation logic, separate cost and price, and test against completed jobs.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'how-to-follow-up-on-a-quote',
    category: 'contractor-business',
    title: 'How to Follow Up on a Quote Without Losing the Job',
    description:
      'Practical guide to following up on quotes: when to follow up, what to say, how many times, handling objections, and using automated follow-ups to win more jobs without chasing.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'how-to-start-a-roofing-business-uk',
    category: 'contractor-business',
    title: 'How to Start a Roofing Business in the UK: Practical Guide',
    description:
      'Complete guide to starting a roofing business in the UK: qualifications, insurance, pricing, finding work, quoting, invoicing, and growing from sole trader to employer. With free tools and templates.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'ai-roof-measuring',
    category: 'ai',
    title: 'AI Roof Measuring: How to Measure a Roof with AI in 2026',
    description:
      'What AI roof measuring can actually do in 2026: how AI traces roof plans, detects lines, and classifies geometry. Where it excels, where it struggles, and what always needs human verification.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
    draft: true,
  },
  {
    slug: 'ai-roofing-tools-guide',
    category: 'ai',
    title: 'AI Roofing Tools: The Complete Guide to AI in Roofing (2026)',
    description:
      'Honest guide to AI in roofing: the three layers of AI technology, what it does well, what it does poorly, what always needs a human, and how to evaluate AI roofing tools for your business.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
    draft: true,
  },
  {
    slug: 'roofing-estimating-vs-quoting',
    category: 'roofing-estimating',
    title: 'Roofing Estimating vs Quoting: What\'s the Difference?',
    description:
      'Estimating and quoting are often confused but serve different purposes in roofing. Learn what each involves, how they connect, and why combining them in one workflow saves time.',
    date: '2026-08-09',
    lastModified: '2026-08-09',
  },
  {
    slug: 'how-to-estimate-roofing-materials',
    category: 'roofing-estimating',
    title: 'How to Estimate Roofing Materials Accurately: A Complete Guide',
    description:
      'Learn how to estimate roofing materials with accuracy. Covers roof measurement, material quantities, waste allowances, and how digital takeoff tools reduce errors.',
    date: '2026-08-09',
    lastModified: '2026-08-09',
  },
  {
    slug: 'manual-vs-digital-roof-takeoff',
    category: 'digital-takeoffs',
    title: 'Manual vs Digital Roof Takeoff: Time, Cost and Accuracy Compared',
    description:
      'Manual roof takeoff with a scale rule vs digital takeoff with software. Compare time per job, accuracy, material waste, and cost to decide which method wins.',
    date: '2026-08-09',
    lastModified: '2026-08-09',
  },
  {
    slug: 'how-to-reduce-roofing-waste',
    category: 'roofing-estimating',
    title: 'How to Reduce Roofing Waste in Estimates: 7 Practical Strategies',
    description:
      'Roofing waste eats your profit margins. Learn 7 practical strategies to reduce waste in your estimates, from accurate takeoffs to Smart Components that apply the right waste factor automatically.',
    date: '2026-08-09',
    lastModified: '2026-08-09',
  },
  {
    slug: 'ai-quoting-software',
    category: 'ai',
    title: 'AI Quoting Software: Can AI Write Quotes for Contractors?',
    description:
      'Can AI write quotes for contractors? What AI quoting software can do (draft line items, calculate materials, format documents) and what it cannot do (set prices, assess job difficulty, define scope).',
    date: '2026-07-29',
    lastModified: '2026-07-29',
    draft: true,
  },
];

/** Map slug -> BlogPostMeta for quick lookups. */
export const BLOG_POST_MAP = new Map(BLOG_POSTS.map((p) => [p.slug, p]));

/** Get all blog slugs (for generateStaticParams). */
export function getBlogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}

/** Get posts visible on the blog index (excludes drafts). */
export function getPublishedPosts(): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => !p.draft);
}

/** Get posts for the sitemap (excludes drafts). */
export function getSitemapPosts(): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => !p.draft);
}

/** Get published posts by category. */
export function getPostsByCategory(category: BlogCategory): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => !p.draft && p.category === category);
}

/** All blog categories with display names. */
export const BLOG_CATEGORIES: { slug: BlogCategory; title: string; description: string }[] = [
  { slug: 'roofing-estimating', title: 'Roofing Estimating Guides', description: 'Measurement, pricing, waste, materials, and calculations for roofing contractors.' },
  { slug: 'construction-quoting', title: 'Construction Quoting Guides', description: 'Quote workflow, invoicing, purchase orders, and cost estimating for construction trades.' },
  { slug: 'digital-takeoffs', title: 'Digital Takeoff Guides', description: 'Roof takeoff, measurement, and digital plan reading for contractors.' },
  { slug: 'contractor-business', title: 'Contractor Business Guides', description: 'Lead generation, starting a business, quote follow-up, and growing a trade company.' },
  { slug: 'quotecore-guides', title: 'QuoteCore+ Product Guides', description: 'How to use Smart Components, free tools, and the QuoteCore+ quoting workflow.' },
  { slug: 'comparisons', title: 'Software Comparisons', description: 'Roofing quoting software comparisons, reviews, and alternatives.' },
  { slug: 'ai', title: 'AI in Roofing and Construction', description: 'AI roof measuring, AI roofing tools, and AI quoting software guides.' },
];
