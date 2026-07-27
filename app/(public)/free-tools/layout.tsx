import type { ReactNode } from 'react';

const SITE_URL = 'https://quote-core.com';

export const metadata = {
  title: 'Free Tools for Trades - Quote Generator, Calculators, PO & Invoice | QuoteCore+',
  description:
    'Free professional trade tools: quote generator, construction calculators, roof takeoff builder, purchase order generator, and invoice generator. No signup required. Built by trades, for trades.',
  alternates: { canonical: `${SITE_URL}/free-tools` },
  openGraph: {
    title: 'Free Tools for Trades - Quote Generator, Calculators, PO & Invoice',
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
  description: 'Free professional trade tools including calculators, generators, and a roof takeoff builder.',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Roof Takeoff Builder', url: `${SITE_URL}/free-roofing-takeoff-builder` },
    { '@type': 'ListItem', position: 2, name: 'Roofing Calculator', url: `${SITE_URL}/free-roofing-calculator` },
    { '@type': 'ListItem', position: 3, name: 'Construction Calculator', url: `${SITE_URL}/free-construction-calculator` },
    { '@type': 'ListItem', position: 4, name: 'Concrete Calculator', url: `${SITE_URL}/free-concrete-calculator` },
    { '@type': 'ListItem', position: 5, name: 'Landscaping Calculator', url: `${SITE_URL}/free-landscaping-calculator` },
    { '@type': 'ListItem', position: 6, name: 'Quote Generator', url: `${SITE_URL}/free-quote-generator` },
    { '@type': 'ListItem', position: 7, name: 'Invoice Generator', url: `${SITE_URL}/free-invoice-generator` },
    { '@type': 'ListItem', position: 8, name: 'Purchase Order Generator', url: `${SITE_URL}/free-purchase-order-generator` },
  ],
};

export default function FreeToolsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      {children}
    </>
  );
}