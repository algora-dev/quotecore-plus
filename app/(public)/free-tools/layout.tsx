import type { ReactNode } from 'react';

const SITE_URL = 'https://quote-core.com';

export const metadata = {
  title: 'Free Tools for Trades - Quote Generator, Calculators, PO & Invoice | QuoteCore+',
  description:
    'Free professional trade tools: quote generator, construction calculators, purchase order generator, and invoice generator. No signup required. Built by trades, for trades.',
  alternates: { canonical: `${SITE_URL}/free-tools` },
  openGraph: {
    title: 'Free Tools for Trades - Quote Generator, Calculators, PO & Invoice',
    description:
      'Free professional trade tools: quote generator, construction calculators, purchase order generator, and invoice generator. No signup required.',
    url: `${SITE_URL}/free-tools`,
    type: 'website',
  },
};

export default function FreeToolsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
