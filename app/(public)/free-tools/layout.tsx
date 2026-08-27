import type { ReactNode } from 'react';
import { TOOLS } from './tools-data';
import { hreflangLanguages } from '@/lib/seo/hreflang';

const SITE_URL = 'https://quote-core.com';

export const metadata = {
  title: 'QuoteCore Plus Free Tools | Roofing & Construction Calculators',
  description:
    'Free professional roofing calculators, roof takeoff builder, quote generator, invoice generator, and purchase order generator. No signup required. Built by a roofer, for roofers.',
  alternates: {
    canonical: `${SITE_URL}/free-tools`,
    languages: hreflangLanguages('/free-tools'),
  },
  openGraph: {
    title: 'QuoteCore Plus Free Tools | Roofing & Construction Calculators',
    description:
      'Free professional roofing calculators, roof takeoff builder, quote generator, invoice generator, and purchase order generator. No signup required.',
    url: `${SITE_URL}/free-tools`,
    type: 'website',
    images: [{ url: '/logo.png', alt: 'QuoteCore+ Free Tools' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Tools for Trades - Calculators, Generators & More',
    description: 'Free professional trade tools. No signup required. Built by trades, for trades.',
    images: ['/logo.png'],
  },
};

const itemListLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Free Trade Tools',
  description: `Free professional trade tools including ${TOOLS.length} calculators, generators, and a roof takeoff builder.`,
  itemListElement: TOOLS.map((tool, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: tool.name,
    url: `${SITE_URL}/${tool.slug}`,
  })),
};

const collectionLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Free Roofing & Construction Tools',
  description:
    'Free online tools for roofing and construction: digital roof takeoff, calculators, quote generator, invoice generator and purchase order tools. No signup required for most tools.',
  url: `${SITE_URL}/free-tools`,
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Free Tools', item: `${SITE_URL}/free-tools` },
  ],
};

export default function FreeToolsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {children}
    </>
  );
}
