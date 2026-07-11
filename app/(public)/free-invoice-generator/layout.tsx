import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Invoice Generator — Create Professional Invoices | QuoteCore+',
  description:
    'Free online invoice generator for trades. Create professional invoices with line items, VAT, and payment terms. No signup — download as PDF.',
  openGraph: {
    title: 'Free Invoice Generator — Create Professional Invoices',
    description: 'Create professional invoices in minutes. No signup required.',
  },
  alternates: { canonical: '/free-invoice-generator' },
};

export default function InvoiceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
