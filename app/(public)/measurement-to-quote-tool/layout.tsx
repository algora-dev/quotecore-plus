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
  const path = '/measurement-to-quote-tool';
  const title = 'Free Measurement-to-Quote Tool';
  const description =
    'Already have your measurements? Turn areas, lengths and quantities into materials, labour and pricing using reusable components. Free to use, no signup required.';
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
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is a measurement-to-quote tool?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A free tool for contractors who already have measurements from a site measure, plan takeoff or estimating workflow. You build reusable pricing components, enter your measured quantities, and the tool calculates materials, labour and a priced output you can print, download, convert into a customer quote, or save to QuoteCore+.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I import my spreadsheet price list?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Upload a CSV export of your price list, map your columns to component fields such as name, material price, labour rate, waste and pack pricing, then select the rows to import. The free converter handles up to 7 components at a time.',
        },
      },
      {
        '@type': 'Question',
        name: 'What measurement types can I use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Area measurements such as square metres or square feet, lineal measurements such as metres or feet, and simple quantity counts. Components can include percentage waste or a fixed waste allowance per length.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does the tool apply roof pitch calculations?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Choose plan measurements and pitch factors are applied automatically to components with pitch logic enabled, for rafter and hip or valley lengths and roof areas.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is the measurement-to-quote tool free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. The core workflow is free to use with no signup required. You can create an account to save components and continue in the app, but the free tool works on its own.',
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
