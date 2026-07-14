import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { TradeConfig } from './types';
import { signupHref } from './types';
import { FreeToolsAuthProvider } from '../../_components/FreeToolsAuthProvider';
import { FreeToolsAuthButton } from '../../_components/FreeToolsAuthButton';

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
    <FreeToolsAuthProvider>
    <div className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/free-tools" prefetch={false} className="flex items-center gap-2">
            <Image src="/logo.png" alt="QuoteCore+" width={140} height={32} className="h-8 w-auto" priority />
          </Link>
          <div className="flex items-center gap-3">
            <FreeToolsAuthButton />
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-2 lg:px-6">
          <Link href="/free-tools" prefetch={false} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Free Tools
          </Link>
        </div>
      </div>

      {children}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              QuoteCore+ - quoting and job management for trade businesses.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/free-tools" prefetch={false} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                Free Tools
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
    </FreeToolsAuthProvider>
  );
}
