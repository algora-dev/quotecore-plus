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

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;        // ISO date (datePublished)
  lastModified: string; // ISO date for sitemap
  draft?: boolean;     // if true, hidden from index, noindex, excluded from sitemap
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: 'quotecore-plus-reviews',
    title: 'QuoteCore+ Reviews: Is It Legit and Who Is It For?',
    description:
      'Wondering if QuoteCore+ is legit? Here\u2019s what the platform does, who it is for, how the free trial works, and how it helps construction businesses manage the workflow from quote to material orders, job management and invoicing.',
    date: '2026-05-27',
    lastModified: '2026-05-27',
  },
  {
    slug: 'quotecore-plus-vs-quotesmith',
    title: 'QuoteCore+ vs QuoteSmith: Proposal Writer or Full Quote Workflow?',
    description:
      'QuoteSmith and QuoteCore+ both help trades create better quotes, but they solve different problems. One focuses on proposal writing, the other on the workflow from measurement to quote, material orders, job management and invoicing.',
    date: '2026-05-23',
    lastModified: '2026-05-23',
  },
  {
    slug: 'roofing-quoting-software-uk',
    title: 'How UK Roofing Contractors Are Getting Quotes Out Faster',
    description:
      'Many UK roofing businesses lose time after the site visit, when notes, photos, pricing and material details have to be pulled together manually. Here\u2019s how a better quote workflow helps.',
    date: '2026-05-06',
    lastModified: '2026-05-06',
  },
  {
    slug: 'roofing-quoting-software-vs-spreadsheets',
    title: 'Roofing Quoting Software vs Spreadsheets: What Actually Saves Time?',
    description:
      'Spreadsheets can work for roofing quotes, but they start to slow businesses down when measurements, pricing, approvals, material orders, job details and invoicing need to stay connected.',
    date: '2026-05-11',
    lastModified: '2026-05-11',
  },
  {
    slug: 'built-by-a-roofer',
    title: 'Built From Roofing Experience: The Story Behind QuoteCore+',
    description:
      'QuoteCore+ was shaped by real roofing and construction experience, with Shaun leading the product direction around the quoting and job workflow problems trades businesses deal with every day.',
    date: '2026-05-06',
    lastModified: '2026-05-06',
  },
  {
    slug: 'construction-quote-speed-checklist',
    title: 'The Construction Quote Speed Checklist',
    description:
      'A practical checklist for construction businesses that want to send quotes faster without rushing the numbers or losing track of job details.',
    date: '2026-06-05',
    lastModified: '2026-06-05',
  },
  {
    slug: 'how-to-get-more-work-as-a-contractor',
    title: 'How to Get More Work as a Contractor: 7 Things to Fix Before You Spend Money on Ads',
    description:
      'Most contractors don\u2019t struggle because they\u2019re bad at the work - they struggle because getting work is left to chance. Here are 7 things to fix first, plus a free weekly checklist.',
    date: '2026-06-13',
    lastModified: '2026-06-13',
  },
  {
    slug: 'best-roofing-quoting-software-uk-2026',
    title: 'Best Roofing Quoting Software UK (2026): Compared for Contractors',
    description:
      'Comparing the best roofing quoting software available to UK contractors in 2026. Honest breakdown of QuoteCore+, Sleepless Tradesman, Tradify, Jobber, Powered Now, Fergus, and EasyEstimate - with a comparison table and recommendations by business type.',
    date: '2026-06-15',
    lastModified: '2026-06-15',
  },
  {
    slug: 'how-to-calculate-roof-pitch',
    title: 'How to Calculate Roof Pitch (And Why It Matters for Your Quote)',
    description:
      'Complete guide to roof pitch: what it is, the three ways it gets expressed (degrees, ratio, percentage), how to calculate it from measurements, common mistakes, and free tools that do the maths for you.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-to-measure-a-roof',
    title: 'How to Measure a Roof for Materials (Complete Guide)',
    description:
      'Three ways to measure a roof (site visit, plans, digital takeoff), how to calculate actual surface area from plan dimensions with pitch factors, and free tools that handle the maths for you.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-much-roofing-material',
    title: 'How Much Roofing Material Do You Need? (Material Calculator Guide)',
    description:
      'How to calculate tile, underlay, batten, and fixing quantities for any roofing job. Real coverage rates, waste allowances by roof type, and free tools that do the calculation for you.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-to-price-a-roofing-job',
    title: 'How to Price a Roofing Job: Step-by-Step Pricing Guide',
    description:
      'Complete roofing pricing guide with worked example. Covers materials, labour, scaffold, disposal, overhead, profit margin, common pricing mistakes, and how to present your price professionally.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'best-free-tools-for-roofers',
    title: 'Best Free Tools for Roofers and Contractors (2026)',
    description:
      'Complete list of the best free roofing and construction tools: takeoff builder, pitch calculator, area calculator, material calculator, quote generator, invoice generator, and 30+ specialised calculators. All free, no signup.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-to-do-a-roof-takeoff',
    title: 'How to Do a Roof Takeoff: Complete Step-by-Step Guide',
    description:
      'Complete roof takeoff guide: measure roof area from plans, calculate pitch-adjusted quantities, separate roof planes and linear components, apply waste, and produce a material order. With free tools and video walkthroughs.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'roofing-material-list',
    title: 'Roofing Material List: What You Need for Every Roof Type',
    description:
      'Complete roofing material list for every roof type: tiles, slates, shingles, metal sheets, flat roofs, and membranes. Covers underlay, battens, fixings, flashings, gutters, and accessories with free calculators for each.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'how-to-create-an-invoice-for-contractors',
    title: 'How to Create an Invoice: Free Guide for Contractors',
    description:
      'Step-by-step invoice guide for contractors: what to include, how to number invoices, describe work clearly, calculate tax, set payment terms, handle variations, and avoid common mistakes. With free invoice generator.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'how-to-send-a-purchase-order',
    title: 'How to Send a Purchase Order to a Supplier',
    description:
      'Complete purchase order guide for contractors: what a PO includes, how to number and send it, avoid common mistakes, and connect quotes to material ordering. With free purchase order generator.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'roofing-waste-calculation',
    title: 'Roofing Waste Calculation: How Much Extra Material to Order',
    description:
      'How to calculate roofing waste allowances by material type, roof complexity, and product format. Covers net vs gross vs order quantities, linear materials, fixings, and common mistakes. With free waste calculator.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'construction-cost-estimator-guide',
    title: 'Construction Cost Estimator: How to Budget Any Project',
    description:
      'Complete construction cost estimating guide: scope definition, quantity measurement, material pricing, labour estimation, subcontractors, overheads, risk, and margin. With free construction and concrete calculators.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'roof-replacement-cost-guide-uk',
    title: 'Roof Replacement Cost Guide: How to Build an Accurate UK Estimate',
    description:
      'How to build an accurate roof replacement cost estimate in the UK: factors that drive cost, material price ranges, labour and access, stripping and disposal, and how to present a replacement quote professionally.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'reusable-quoting-templates-smart-components',
    title: 'Reusable Quoting Templates: A Practical Guide to Smart Components',
    description:
      'How to build reusable quoting templates with Smart Components: choose repeatable work units, define inputs, add materials, build calculation logic, separate cost and price, and test against completed jobs.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'how-to-follow-up-on-a-quote',
    title: 'How to Follow Up on a Quote Without Losing the Job',
    description:
      'Practical guide to following up on quotes: when to follow up, what to say, how many times, handling objections, and using automated follow-ups to win more jobs without chasing.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'how-to-start-a-roofing-business-uk',
    title: 'How to Start a Roofing Business in the UK: Practical Guide',
    description:
      'Complete guide to starting a roofing business in the UK: qualifications, insurance, pricing, finding work, quoting, invoicing, and growing from sole trader to employer. With free tools and templates.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'ai-roof-measuring',
    title: 'AI Roof Measuring: How to Measure a Roof with AI in 2026',
    description:
      'What AI roof measuring can actually do in 2026: how AI traces roof plans, detects lines, and classifies geometry. Where it excels, where it struggles, and what always needs human verification.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
    draft: true,
  },
  {
    slug: 'ai-roofing-tools-guide',
    title: 'AI Roofing Tools: The Complete Guide to AI in Roofing (2026)',
    description:
      'Honest guide to AI in roofing: the three layers of AI technology, what it does well, what it does poorly, what always needs a human, and how to evaluate AI roofing tools for your business.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
    draft: true,
  },
  {
    slug: 'ai-quoting-software',
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
