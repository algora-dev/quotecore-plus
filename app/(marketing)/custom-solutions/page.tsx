import type { Metadata } from 'next';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { siteUrl, buildBreadcrumbSchema } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';

const T3_CUSTOM_SOFTWARE =
  'https://www.t3labs.tech/custom-software?utm_source=quotecore&utm_medium=referral&utm_campaign=custom-solutions';

const T3_CASE_STUDY =
  'https://www.t3labs.tech/case-studies/quotecore?utm_source=quotecore&utm_medium=referral&utm_campaign=custom-solutions';

export const metadata: Metadata = {
  title: 'Custom Solutions — Configure QuoteCore+ or Build Bespoke | QuoteCore+',
  description:
    'QuoteCore+ can be configured around most estimating, pricing and workflow requirements. For genuinely bespoke needs, our development partner T3 Labs builds custom software.',
  alternates: {
    canonical: 'https://quote-core.com/custom-solutions',
    languages: hreflangLanguages('/custom-solutions'),
  },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: siteUrl },
  { name: 'Custom Solutions', url: `${siteUrl}/custom-solutions` },
]);

const configureItems = [
  'Your own products and materials',
  'Your own pricing, costs and margins',
  'Your labour rates',
  'Your waste rules (fixed or percentage)',
  'Supplier catalogues and price lists',
  'Reusable Smart Components',
  'Measurements from plans, scans or site',
  'Your quote, order and invoice documents',
];

const bespokeItems = [
  'A unique integration with another system',
  'A proprietary workflow QuoteCore+ doesn\'t cover',
  'A customer or supplier portal',
  'A separate internal application',
  'Specialist automation',
  'Software you own or resell',
  'Functionality outside QuoteCore+\'s scope',
];

export default function CustomSolutionsPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Custom Solutions — Configure QuoteCore+ or Build Bespoke',
    description:
      'Two paths: configure QuoteCore+ around your estimating, pricing and workflow, or have our development partner T3 Labs build something bespoke.',
    url: `${siteUrl}/custom-solutions`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <BlogHeader />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
        <nav className="mb-6 text-sm text-slate-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-slate-900">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700">Custom Solutions</span>
        </nav>

        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Need Something QuoteCore+ Doesn&rsquo;t Do Yet?
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          QuoteCore+ can already be configured around many estimating, pricing and
          workflow requirements. If your business needs something genuinely bespoke, our
          development partner T3 Labs can help build it.
        </p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
          The honest answer depends on one question: is the missing piece{' '}
          <strong className="text-slate-900">configuration</strong> or{' '}
          <strong className="text-slate-900">engineering</strong>?
        </p>

        {/* Two paths */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Path 1: Configure */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#BD4A1A]">
              Path 1
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Configure QuoteCore+
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use this when the requirement is about{' '}
              <strong>your own rules and content</strong> — most &ldquo;custom&rdquo;
              requests land here:
            </p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-700">
              {configureItems.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 text-[#BD4A1A]">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <Link
                href="/features"
                className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.45)]"
              >
                See What QuoteCore+ Can Configure
              </Link>
              <p className="mt-3 text-xs text-slate-500">
                Or{' '}
                <Link href="/free-trial" className="font-medium text-[#BD4A1A] hover:underline">
                  start a free trial
                </Link>{' '}
                and try it with your own pricing.
              </p>
            </div>
          </div>

          {/* Path 2: Bespoke */}
          <div className="flex flex-col rounded-2xl border border-slate-300 bg-slate-50 p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Path 2
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Build Something Bespoke
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use this when the requirement needs{' '}
              <strong>engineering, not setup</strong>:
            </p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-700">
              {bespokeItems.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 text-slate-400">
                    ▸
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <a
                href={T3_CUSTOM_SOFTWARE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-full border border-slate-900 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                Talk to T3 Labs <span aria-hidden="true">&rarr;</span>
              </a>
              <p className="mt-3 text-xs text-slate-500">
                T3 Labs built QuoteCore+ — read the{' '}
                <a
                  href={T3_CASE_STUDY}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#BD4A1A] hover:underline"
                >
                  case study
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        {/* How to decide */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Not sure which one you need?
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Start by trying QuoteCore+ on a real job. If it can be set up around your
            pricing and workflow, configuration is the answer — at a fraction of the cost
            of a custom build. If you hit a wall that setup genuinely can&rsquo;t solve,
            that&rsquo;s the point where a bespoke build makes sense, and T3 Labs will
            tell you honestly which it is.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href="/free-trial"
              className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.45)]"
            >
              Try QuoteCore+ Free
            </Link>
            <Link
              href="/blog/custom-roofing-quoting-software"
              className="inline-block rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:border-slate-400 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Read: Built or Configured?
            </Link>
          </div>
        </section>

        {/* Who is T3 Labs */}
        <section className="mt-16 rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Who is T3 Labs?
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            T3 Labs is the product studio behind QuoteCore+. They build custom
            estimating, pricing, portal, integration and workflow software for businesses
            whose requirements genuinely exceed what existing platforms offer — and
            QuoteCore+ itself is their work, live and in production. When a requirement
            is better served by configuration, they&rsquo;ll point you back here.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
