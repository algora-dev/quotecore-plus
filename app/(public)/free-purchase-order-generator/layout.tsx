import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Purchase Order Generator - Create Supplier POs | QuoteCore+',
  description:
    'Free online purchase order generator for trades. Create professional POs for suppliers with line items and delivery dates. No signup - download as PDF.',
  openGraph: {
    title: 'Free Purchase Order Generator - Create Supplier POs',
    description: 'Create professional purchase orders in minutes. No signup required.',
  },
  alternates: { canonical: '/free-purchase-order-generator' },
};

export default function POLayout({ children }: { children: React.ReactNode }) {
  return children;
}
