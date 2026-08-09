import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlogHeader from '@/components/BlogHeader';
import {
  buildPageMetadata,
  breadcrumbSchema,
  blogPostingSchema,
  SITE_URL,
} from '@/app/lib/seo';
import { BLOG_POST_MAP } from '@/app/lib/blog-posts';

// Content imports - keep inline (page-specific dynamic imports)
const contentLoaders: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  'quotecore-plus-reviews': () => import('./content/quotecore-plus-reviews'),
  'quotecore-plus-vs-quotesmith': () => import('./content/quotecore-plus-vs-quotesmith'),
  'roofing-quoting-software-uk': () => import('./content/roofing-quoting-software-uk'),
  'roofing-quoting-software-vs-spreadsheets': () => import('./content/roofing-quoting-software-vs-spreadsheets'),
  'built-by-a-roofer': () => import('./content/built-by-a-roofer'),
  'construction-quote-speed-checklist': () => import('./content/construction-quote-speed-checklist'),
  'how-to-get-more-work-as-a-contractor': () => import('./content/how-to-get-more-work-as-a-contractor'),
  'best-roofing-quoting-software-uk-2026': () => import('./content/best-roofing-quoting-software-uk-2026'),
  'best-quoting-software-nz': () => import('./content/best-quoting-software-nz'),
  'best-quoting-software-au': () => import('./content/best-quoting-software-au'),
  'best-quoting-software-us': () => import('./content/best-quoting-software-us'),
  'how-to-calculate-roof-pitch': () => import('./content/how-to-calculate-roof-pitch'),
  'how-to-measure-a-roof': () => import('./content/how-to-measure-a-roof'),
  'how-much-roofing-material': () => import('./content/how-much-roofing-material'),
  'how-to-price-a-roofing-job': () => import('./content/how-to-price-a-roofing-job'),
  'best-free-tools-for-roofers': () => import('./content/best-free-tools-for-roofers'),
  'ai-roof-measuring': () => import('./content/ai-roof-measuring'),
  'ai-roofing-tools-guide': () => import('./content/ai-roofing-tools-guide'),
  'ai-quoting-software': () => import('./content/ai-quoting-software'),
  'how-to-do-a-roof-takeoff': () => import('./content/how-to-do-a-roof-takeoff'),
  'roofing-material-list': () => import('./content/roofing-material-list'),
  'how-to-create-an-invoice-for-contractors': () => import('./content/how-to-create-an-invoice-for-contractors'),
  'how-to-send-a-purchase-order': () => import('./content/how-to-send-a-purchase-order'),
  'roofing-waste-calculation': () => import('./content/roofing-waste-calculation'),
  'construction-cost-estimator-guide': () => import('./content/construction-cost-estimator-guide'),
  'roof-replacement-cost-guide-uk': () => import('./content/roof-replacement-cost-guide-uk'),
  'reusable-quoting-templates-smart-components': () => import('./content/reusable-quoting-templates-smart-components'),
  'how-to-follow-up-on-a-quote': () => import('./content/how-to-follow-up-on-a-quote'),
  'how-to-start-a-roofing-business-uk': () => import('./content/how-to-start-a-roofing-business-uk'),
  'roofing-estimating-vs-quoting': () => import('./content/roofing-estimating-vs-quoting'),
  'how-to-estimate-roofing-materials': () => import('./content/how-to-estimate-roofing-materials'),
  'manual-vs-digital-roof-takeoff': () => import('./content/manual-vs-digital-roof-takeoff'),
  'how-to-reduce-roofing-waste': () => import('./content/how-to-reduce-roofing-waste'),
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POST_MAP.get(slug);
  if (!post) return {};

  const metadata = buildPageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${slug}`,
    type: 'article',
  });

  if (post.draft) {
    return {
      ...metadata,
      robots: { index: false, follow: false },
    };
  }

  return metadata;
}

export async function generateStaticParams() {
  return Array.from(BLOG_POST_MAP.keys()).map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = BLOG_POST_MAP.get(slug);
  if (!post) notFound();

  const contentLoader = contentLoaders[slug];
  if (!contentLoader) notFound();
  const { default: Content } = await contentLoader();

  const faqSchema = post.faqs && post.faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  } : null;

  const blogSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      blogPostingSchema({
        title: post.title,
        description: post.description,
        slug,
        datePublished: post.date,
        dateModified: post.lastModified || post.date,
      }),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
        { name: post.title, path: `/blog/${slug}` },
      ]),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <div className="min-h-screen bg-white text-zinc-950">
        <BlogHeader backLabel="Back to blogs" backHref="/blog" />
        <main>
        <article className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
          <p className="text-sm text-zinc-500">
            {new Date(post.date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
            {post.title}
          </h1>

          {/* Author byline */}
          <div className="mt-4 flex items-center gap-3">
            <img
              src="/shaun-smiling.jpg"
              alt="Shaun, Founder of QuoteCore+"
              className="h-9 w-9 rounded-full object-cover border border-zinc-200 shrink-0"
            />
            <p className="text-sm text-zinc-500">
              By <span className="font-medium text-zinc-700">Shaun</span>, Founder of QuoteCore+. Reviewed {new Date(post.lastModified || post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
          </div>

          <div className="prose prose-zinc mt-10 max-w-none">
            <Content />
          </div>

          {/* Internal links */}
          <div className="mt-16 flex flex-col gap-3 rounded-[1.75rem] border border-[#FF6B35]/20 bg-[#FF6B35]/5 p-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-zinc-950">Ready to quote faster?</p>
            <div className="flex gap-3">
              <a
                href="/"
                className="pill-shimmer inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
              >
                Explore QuoteCore+
              </a>
              <a
                href="/free-trial"
                className="inline-flex items-center justify-center rounded-full bg-[#E55A28] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#BD4A1A]"
              >
                Start free trial
              </a>
            </div>
          </div>
        </article>
        </main>
        <div className="mt-12 border-t border-zinc-200 pt-8 text-center" />
      </div>
    </>
  );
}
