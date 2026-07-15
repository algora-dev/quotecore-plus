import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import BlogHeader from '@/components/BlogHeader';
import {
  buildPageMetadata,
  breadcrumbSchema,
  blogPostingSchema,
  SITE_URL,
} from '@/app/lib/seo';
import { BLOG_POST_MAP } from '@/app/lib/blog-posts';

// Content imports — keep inline (page-specific dynamic imports)
const contentLoaders: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  'quotecore-plus-reviews': () => import('./content/quotecore-plus-reviews'),
  'quotecore-plus-vs-quotesmith': () => import('./content/quotecore-plus-vs-quotesmith'),
  'roofing-quoting-software-uk': () => import('./content/roofing-quoting-software-uk'),
  'roofing-quoting-software-vs-spreadsheets': () => import('./content/roofing-quoting-software-vs-spreadsheets'),
  'built-by-a-roofer': () => import('./content/built-by-a-roofer'),
  'construction-quote-speed-checklist': () => import('./content/construction-quote-speed-checklist'),
  'how-to-get-more-work-as-a-contractor': () => import('./content/how-to-get-more-work-as-a-contractor'),
  'best-roofing-quoting-software-uk-2026': () => import('./content/best-roofing-quoting-software-uk-2026'),
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POST_MAP.get(slug);
  if (!post) return {};

  return buildPageMetadata({
    title: `${post.title} | QuoteCore+`,
    description: post.description,
    path: `/blog/${slug}`,
    type: 'article',
  });
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

  const faqSchema = slug === 'best-roofing-quoting-software-uk-2026' ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is roofing quoting software?',
        acceptedAnswer: { '@type': 'Answer', text: 'Roofing quoting software helps contractors turn measurements and job specifications into professional, priced quotes without spreadsheets or manual calculation. The best tools for roofers include workflows specific to roofing: digital takeoffs, component-level pricing, material calculations, and structured output that customers can read and act on.' },
      },
      {
        '@type': 'Question',
        name: 'What is the best roofing quoting software for UK contractors in 2026?',
        acceptedAnswer: { '@type': 'Answer', text: 'The best option depends on your workflow. QuoteCore+ is the strongest for contractors quoting from plans who need a full workflow from measurement to quote, material orders, job management and invoicing. Sleepless Tradesman is a strong choice for sole traders doing high volumes of repair work who want AI-assisted quoting from customer photos. Tradify works well for small teams that need job management alongside quoting.' },
      },
      {
        '@type': 'Question',
        name: 'How long does it take to send a roofing quote with software?',
        acceptedAnswer: { '@type': 'Answer', text: 'With a platform like QuoteCore+, most contractors send their first quote within minutes of entering their measurements. The goal is to quote the same day as the site visit - ideally before leaving. The delay in most quoting processes is not measurement but the admin that comes after it.' },
      },
      {
        '@type': 'Question',
        name: 'Do I need to be technical to use roofing quoting software?',
        acceptedAnswer: { '@type': 'Answer', text: 'No. Modern quoting software is designed to be usable from day one. If you can use email and a computer, you can use most platforms on this list. The best ones require no setup beyond entering your pricing templates.' },
      },
      {
        '@type': 'Question',
        name: 'Is there free roofing quoting software for UK roofers?',
        acceptedAnswer: { '@type': 'Answer', text: 'QuoteCore+ offers a 14-day free trial with no credit card required. Sleepless Tradesman has a free tier with a limited number of quotes per month. Most other platforms on this list do not offer a free option, though some include a trial period.' },
      },
      {
        '@type': 'Question',
        name: 'What should a professional roofing quote include?',
        acceptedAnswer: { '@type': 'Answer', text: 'A professional roofing quote should include: a clear scope of work, itemised materials and labour, scaffold costs as a separate line item, your company details and accreditations, a validity period, and a way for the customer to accept or decline.' },
      },
      {
        '@type': 'Question',
        name: 'Can roofing quoting software help me win more jobs?',
        acceptedAnswer: { '@type': 'Answer', text: 'Yes - indirectly. Research suggests the first contractor to respond wins a significant proportion of competitive quote situations. Software that helps you quote faster, and that produces a more professional output, improves your position in both dimensions.' },
      },
    ],
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
      <Script
        id={`blog-schema-${slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      {faqSchema && (
        <Script
          id={`faq-schema-${slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <div className="min-h-screen bg-white text-zinc-950">
        <BlogHeader backLabel="Back to blogs" backHref="/blog" />
        <article className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
          <p className="text-sm text-zinc-400">
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
              By <span className="font-medium text-zinc-700">Shaun</span>, Founder of QuoteCore+.
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
                Learn more
              </a>
              <a
                href="/free-trial"
                className="inline-flex items-center justify-center rounded-full bg-[#BD4A1A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#A03E15]"
              >
                Start free trial
              </a>
            </div>
          </div>
        </article>
        <div className="mt-12 border-t border-zinc-200 pt-8 text-center" />
      </div>
    </>
  );
}
