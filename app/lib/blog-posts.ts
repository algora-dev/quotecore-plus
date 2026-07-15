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
];

/** Map slug -> BlogPostMeta for quick lookups. */
export const BLOG_POST_MAP = new Map(BLOG_POSTS.map((p) => [p.slug, p]));

/** Get all blog slugs (for generateStaticParams). */
export function getBlogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}
