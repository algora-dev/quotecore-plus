import type { ReactNode } from 'react';
import { TOOLS } from './tools-data';
import { hreflangLanguages } from '@/lib/seo/hreflang';

const SITE_URL = 'https://quote-core.com';

export const metadata = {
  title: 'Free Trade Tools - Calculators & Generators | QuoteCore+',
  description:
    'Free professional trade tools: quote generator, construction calculators, roof takeoff builder, purchase order generator, and invoice generator. No signup required. Built by trades, for trades.',
  alternates: {
    canonical: `${SITE_URL}/free-tools`,
    languages: hreflangLanguages('/free-tools'),
  },
  openGraph: {
    title: 'Free Trade Tools - Calculators & Generators',
    description:
      'Free professional trade tools: quote generator, construction calculators, roof takeoff builder, purchase order generator, and invoice generator. No signup required.',
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

export default function FreeToolsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      {children}
    </>
  );
}
