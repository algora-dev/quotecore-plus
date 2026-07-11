import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { TradeConfig } from './types';
import { signupHref } from './types';

const SITE_URL = 'https://quote-core.com';

/** Build Next.js metadata for a trade calculator layout from its config. */
export function buildTradeMetadata(config: TradeConfig) {
  return {
    title: config.metaTitle,
    description: config.metaDescription,
    alternates: { canonical: `${SITE_URL}/${config.slug}` },
    openGraph: {
      title: config.ogTitle,
      description: config.ogDescription,
      url: `${SITE_URL}/${config.slug}`,
      type: 'website',
    },
  };
}

/**
 * Shared layout shell for trade calculator pages: JSON-LD (WebApplication +
 * FAQPage), sticky header, footer. Copy comes from the trade config.
 */
export function TradeLayoutShell({ config, children }: { config: TradeConfig; children: ReactNode }) {
  const signup = signupHref(config);

  const webAppLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: config.name,
    description: config.ogDescription,
    applicationCategory: 'CalculatorApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    url: `${SITE_URL}/${config.slug}`,
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: config.content.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/" prefetch={false} className="flex items-center gap-2">
            <Image src="/logo.png" alt="QuoteCore+" width={140} height={32} className="h-8 w-auto" priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/free-calculators"
              prefetch={false}
              className="hidden text-sm font-semibold text-slate-700 hover:text-slate-900 sm:inline"
            >
              All Calculators
            </Link>
            <Link
              href="/free-quote-generator"
              prefetch={false}
              className="hidden text-sm font-semibold text-slate-700 hover:text-slate-900 sm:inline"
            >
              Free Quote Generator
            </Link>
            <Link
              href={signup}
              className="rounded-full bg-[#FF6B35] px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              QuoteCore+ — quoting and job management for trade businesses.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/free-calculators" prefetch={false} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                Free Calculators
              </Link>
              <Link href="/free-quote-generator" prefetch={false} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                Free Quote Generator
              </Link>
              <Link href="/free-invoice-generator" prefetch={false} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                Free Invoice Generator
              </Link>
              <Link href={signup} className="text-xs font-medium text-[#FF6B35] hover:text-[#ff5722]">
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
