import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Quote Generator — Create Professional Quotes Online | QuoteCore+',
  description:
    'Free online quote generator for roofing and construction. Create professional quotes with line items, VAT, and terms. No signup required — download as PDF.',
  openGraph: {
    title: 'Free Quote Generator — Create Professional Quotes Online',
    description: 'Create professional roofing and construction quotes in minutes. No signup required.',
  },
  alternates: { canonical: '/free-quote-generator' },
};

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
