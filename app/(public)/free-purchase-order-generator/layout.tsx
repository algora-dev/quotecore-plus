import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Free Purchase Order Generator - Create Supplier POs | QuoteCore+',
  description:
    'Free online purchase order generator for trades. Create professional POs for suppliers with line items and delivery dates. No signup - download as PDF.',
  openGraph: {
    title: 'Free Purchase Order Generator - Create Supplier POs',
    description: 'Create professional purchase orders in minutes. No signup required.',
    url: `${SITE_URL}/free-purchase-order-generator`,
    type: 'website',
    images: [{ url: '/og-image.png', alt: 'Free Purchase Order Generator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Purchase Order Generator - Create Supplier POs',
    description: 'Create professional purchase orders in minutes. No signup required.',
    images: ['/og-image.png'],
  },
  alternates: { canonical: `${SITE_URL}/free-purchase-order-generator` },
};

const webAppLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Purchase Order Generator',
  description: 'Free online purchase order generator for trades. Create professional POs for suppliers with line items, delivery dates, and business branding. Download as PDF. No signup required.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  url: `${SITE_URL}/free-purchase-order-generator`,
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Free Tools', item: `${SITE_URL}/free-tools` },
    { '@type': 'ListItem', position: 2, name: 'Purchase Order Generator', item: `${SITE_URL}/free-purchase-order-generator` },
  ],
};

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is the purchase order generator really free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The QuoteCore+ free purchase order generator is completely free with no signup required. Create unlimited POs and download as PDF. No watermark, no hidden fees.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I add supplier details to the PO?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Add your supplier name, address, delivery address, delivery date, and job reference. The PO template is designed for trade supplier ordering.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I pre-fill a purchase order?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Use URL parameters to pre-fill line items, quantities, and supplier details. This is useful for re-ordering common materials or generating POs from takeoff calculations.',
      },
    },
    {
      '@type': 'Question',
      name: 'What format is the downloaded purchase order?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Purchase orders download as a professional PDF document, ready to email to your supplier.',
      },
    },
  ],
};

const faqs = [
  { q: 'Is the purchase order generator really free?', a: 'Yes. Create unlimited POs and download as PDF. No watermark, no hidden fees.' },
  { q: 'Can I add supplier details to the PO?', a: 'Yes. Add supplier name, address, delivery address, delivery date, and job reference. Designed for trade supplier ordering.' },
  { q: 'Can I pre-fill a purchase order?', a: 'Yes. Use URL parameters to pre-fill line items, quantities, and supplier details. Useful for re-ordering common materials.' },
  { q: 'What format is the downloaded purchase order?', a: 'Purchase orders download as a professional PDF document, ready to email to your supplier.' },
];

export default function POLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {children}
      <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mb-4">About the Free Purchase Order Generator</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          The QuoteCore+ free purchase order generator helps trades contractors create professional POs for suppliers in minutes.
          Add line items with quantities and unit prices, include supplier and delivery details, apply your branding, and download as PDF.
          No signup required. Built by trades, for trades.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">What you can do</h3>
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li>Line-by-line POs with quantities and unit prices</li>
              <li>AI-assisted POs from photos or text</li>
              <li>Add supplier and delivery details</li>
              <li>Include job references and delivery dates</li>
              <li>Download as professional PDF</li>
              <li>Pre-fill from URL parameters</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Related tools</h3>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/free-quote-generator" className="text-[#BD4A1A] hover:text-[#FF6B35]">Free Quote Generator</Link></li>
              <li><Link href="/free-invoice-generator" className="text-[#BD4A1A] hover:text-[#FF6B35]">Free Invoice Generator</Link></li>
              <li><Link href="/free-roofing-takeoff-builder" className="text-[#BD4A1A] hover:text-[#FF6B35]">Roof Takeoff Builder</Link></li>
              <li><Link href="/free-roofing-calculator" className="text-[#BD4A1A] hover:text-[#FF6B35]">Roofing Calculator</Link></li>
              <li><Link href="/free-tools" className="text-[#BD4A1A] hover:text-[#FF6B35]">All Free Tools</Link></li>
            </ul>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Frequently Asked Questions</h3>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div key={faq.q}>
                <h4 className="text-sm font-medium text-slate-900">{faq.q}</h4>
                <p className="text-sm text-slate-600 mt-1">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
