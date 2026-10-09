import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import {MEASUREMENT_FAQ} from './measurement-content';
import { headers } from 'next/headers';
import { isNzHost, canonicalOrigin, dualDomainHreflang } from '@/lib/seo/dual-domain';

async function getHost() {
  const h = await headers();
  return h.get('host') || '';
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await getHost();
  const origin = canonicalOrigin(host);
  const path = '/measurement-to-quote-tool';
  const title = 'Free Contractor Estimating Tool - Measurements to Pricing & Quotes | QuoteCore+';
  const description =
    'Already have areas, lengths or quantities from a site measure, plan takeoff, aerial measurement, third-party report or spreadsheet? Reusable components apply materials, labor, waste and pricing automatically, then turn the result into a professional estimate or quote. Free, no signup for the core workflow.';
  return {
    title,
    description,
    alternates: { canonical: `${origin}${path}`, languages: dualDomainHreflang(path) },
    openGraph: { title, description, url: `${origin}${path}`, type: 'website', images: [{ url: '/logo.png', alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/logo.png'] },
  };
}

export default async function MeasurementToQuoteLayout({ children }: { children: ReactNode }) {
  const host = await getHost();
  const origin = canonicalOrigin(host);
  const path = '/measurement-to-quote-tool';
  const isNz = isNzHost(host);

  const webAppLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Free Measurement-to-Quote Tool',
    description:
      'Turn areas, lengths and quantities into materials, labour and pricing using reusable components. Import a CSV price list or add components manually. Free, no signup required.',
    applicationCategory: 'CalculatorApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: isNz ? 'NZD' : 'USD' },
    url: `${origin}${path}`,
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Free Tools', item: `${origin}/free-tools` },
      { '@type': 'ListItem', position: 2, name: 'Measurement-to-Quote Tool', item: `${origin}${path}` },
    ],
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: MEASUREMENT_FAQ.map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}})),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {children}
    </>
  );
}
