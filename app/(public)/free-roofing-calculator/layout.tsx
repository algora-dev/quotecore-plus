import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: 'Free Roofing Calculator — Pitch, Area, Rafter Length, Materials | QuoteCore+',
  description:
    'Free roofing calculator. Calculate roof pitch, rafter length, roof surface area, quantities and complex pricing. No signup required - works on mobile and desktop.',
  alternates: { canonical: 'https://quote-core.com/free-roofing-calculator' },
  openGraph: {
    title: 'Free Roofing Calculator — Pitch, Area, Rafter Length, Materials',
    description:
      'Free roofing calculator. Calculate roof pitch, rafter length, roof surface area, and material quantities. No signup required.',
    url: 'https://quote-core.com/free-roofing-calculator',
    type: 'website',
  },
};

export default function RoofingCalculatorLayout({ children }: { children: ReactNode }) {
  const webAppLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Free Roofing Calculator',
    description:
      'Free roofing calculator. Calculate roof pitch, rafter length, roof surface area, and material quantities. No signup required.',
    applicationCategory: 'CalculatorApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    url: 'https://quote-core.com/free-roofing-calculator',
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How do I calculate roof pitch?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Roof pitch is measured in degrees from horizontal. Use a digital level or smartphone app on the roof surface, or measure the rise over run ratio and convert to degrees using: pitch = arctan(rise / run).',
        },
      },
      {
        '@type': 'Question',
        name: 'What is a pitch factor?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A pitch factor converts flat plan area to actual sloped roof area. For a rafter-type roof, the factor is 1 / cos(pitch angle). At 25 degrees, the factor is approximately 1.103, meaning 100 m² of plan area has about 110.3 m² of actual roofing surface.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is rafter length calculated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Rafter length equals half the span divided by the cosine of the pitch angle. For a 10m span at 30 degrees: rafter = (10 / 2) / cos(30) = 5.77m.',
        },
      },
      {
        '@type': 'Question',
        name: 'What waste percentage should I add for roofing materials?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Typical waste percentages: concrete tiles 5-10%, clay tiles 10-15% (fragile), metal sheets 5%, asphalt shingles 10-15%, membrane 5%. Add more for complex roof shapes with many cuts.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is this roofing calculator free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, completely free with no signup required. All calculations run in your browser. No data is sent anywhere.',
        },
      },
    ],
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
              href="/free-quote-generator"
              prefetch={false}
              className="hidden text-sm font-semibold text-slate-700 hover:text-slate-900 sm:inline"
            >
              Free Quote Generator
            </Link>
            <Link
              href="/signup?ref=free-roofing-calculator"
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
              <Link href="/free-quote-generator" prefetch={false} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                Free Quote Generator
              </Link>
              <Link href="/free-invoice-generator" prefetch={false} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                Free Invoice Generator
              </Link>
              <Link href="/signup?ref=free-roofing-calculator" className="text-xs font-medium text-[#FF6B35] hover:text-[#ff5722]">
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
