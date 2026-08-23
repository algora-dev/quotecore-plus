import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { isNzHost, canonicalOrigin, dualDomainHreflang } from '@/lib/seo/dual-domain';

async function getHost() {
  const h = await headers();
  return h.get('host') || '';
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await getHost();
  const origin = canonicalOrigin(host);
  const path = '/free-quote-builder';
  const title = 'Free Quote Builder';
  const description =
    'Free quote builder with smart components. Import your price list from CSV or add components manually, enter your measurements, and get instant priced results. No signup required.';
  return {
    title,
    description,
    alternates: { canonical: `${origin}${path}`, languages: dualDomainHreflang(path) },
    openGraph: { title, description, url: `${origin}${path}`, type: 'website', images: [{ url: '/logo.png', alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/logo.png'] },
  };
}

export default async function FreeQuoteBuilderLayout({ children }: { children: ReactNode }) {
  const host = await getHost();
  const origin = canonicalOrigin(host);
  const path = '/free-quote-builder';
  const isNz = isNzHost(host);

  const webAppLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Free Quote Builder',
    description:
      'Free quote builder with smart components. Import your price list from CSV or add components manually, enter your measurements, and get instant priced results.',
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
      { '@type': 'ListItem', position: 2, name: 'Quote Builder', item: `${origin}${path}` },
    ],
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the free quote builder?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A free tool that turns your own price list into smart components. Import a CSV catalog or add components manually, enter your measurements, and get an instantly priced report.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I import my spreadsheet price list?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Upload a CSV export of your price list, map your columns to component fields such as name, material price, labour rate, waste and pack pricing, then select the rows to import.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does the quote builder apply roof pitch calculations?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Choose plan measurements and pitch factors are applied automatically to components with pitch logic enabled, for rafter and hip or valley lengths and roof areas.',
        },
      },
    ],
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: 'button:not(:disabled){cursor:pointer}' }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {children}
    </>
  );
}
