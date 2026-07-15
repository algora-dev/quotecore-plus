import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const SITE_URL = 'https://quote-core.com';

export const metadata = {
  title: 'Free Trade Calculators - Roofing, Construction, Concrete & More | QuoteCore+',
  description:
    'Free online calculators for trades: roofing, construction, concrete, and landscaping. Areas, volumes, angles, material quantities and pricing. No signup required.',
  alternates: { canonical: `${SITE_URL}/free-calculators` },
  openGraph: {
    title: 'Free Trade Calculators - Roofing, Construction, Concrete & More',
    description:
      'Free online calculators for trades. Areas, volumes, angles, material quantities and pricing. No signup required.',
    url: `${SITE_URL}/free-calculators`,
    type: 'website',
  },
};

export default function FreeCalculatorsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/" prefetch={false} className="flex items-center gap-2">
            <Image src="/logo.png" alt="QuoteCore+" width={140} height={32} className="h-8 w-auto" priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/free-quote-generator"
              prefetch={false}
              className="hidden text-sm font-semibold text-slate-700 hover:text-slate-900 sm:inline"
            >
              Free Quote Generator
            </Link>
            <Link
              href="/signup?ref=free-calculators"
              className="rounded-full bg-[#BD4A1A] px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
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
              QuoteCore+ - quoting and job management for trade businesses.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/free-quote-generator" prefetch={false} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                Free Quote Generator
              </Link>
              <Link href="/free-invoice-generator" prefetch={false} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                Free Invoice Generator
              </Link>
              <Link href="/signup?ref=free-calculators" className="text-xs font-medium text-[#BD4A1A] hover:text-[#ff5722]">
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
