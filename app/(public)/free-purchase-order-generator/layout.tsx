import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { isNzHost, canonicalOrigin, dualDomainHreflang } from '@/lib/seo/dual-domain';

const GLOBAL_URL = 'https://quote-core.com';

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get('host') || '';
  const isNz = isNzHost(host);
  const origin = canonicalOrigin(host);
  const path = '/free-purchase-order-generator';

  if (isNz) {
    return {
      title: 'Free Purchase Order Generator for NZ Suppliers',
      description:
        'Free online purchase order generator for NZ trades. Create professional POs for suppliers with line items and delivery dates. No signup - download as PDF.',
      alternates: { canonical: `${origin}${path}`, languages: dualDomainHreflang(path) },
      openGraph: {
        title: 'Free Purchase Order Generator for NZ Suppliers',
        description: 'Create professional POs for NZ suppliers in minutes. No signup required.',
        url: `${origin}${path}`,
        type: 'website',
        images: [{ url: '/og-image.png', alt: 'Free Purchase Order Generator' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Free Purchase Order Generator for NZ Suppliers',
        description: 'Create professional POs for NZ suppliers in minutes. No signup required.',
        images: ['/og-image.png'],
      },
    };
  }

  return {
    title: 'Purchase Order Generator — Free | No Signup',
    description:
      'Free online purchase order generator for trades. Create professional POs for suppliers with line items and delivery dates. No signup - download as PDF.',
    alternates: { canonical: `${origin}${path}`, languages: dualDomainHreflang(path) },
    openGraph: {
      title: 'Free Purchase Order Generator - Create Supplier POs',
      description: 'Create professional purchase orders in minutes. No signup required.',
      url: `${origin}${path}`,
      type: 'website',
      images: [{ url: '/og-image.png', alt: 'Free Purchase Order Generator' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Free Purchase Order Generator - Create Supplier POs',
      description: 'Create professional purchase orders in minutes. No signup required.',
      images: ['/og-image.png'],
    },
  };
}

const webAppLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Purchase Order Generator',
  description: 'Free online purchase order generator for trades. Create professional POs for suppliers with line items, delivery dates, and business branding. Download as PDF. No signup required.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  url: `${GLOBAL_URL}/free-purchase-order-generator`,
  publisher: { '@id': `${GLOBAL_URL}/#organization` },
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Free Tools', item: `${GLOBAL_URL}/free-tools` },
    { '@type': 'ListItem', position: 2, name: 'Purchase Order Generator', item: `${GLOBAL_URL}/free-purchase-order-generator` },
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
          The QuoteCore Plus free purchase order generator helps trades contractors create professional POs for suppliers in minutes.
          Add line items with quantities and unit prices, include supplier and delivery details, apply your branding, and download as PDF.
          No signup required. Built by trades, for trades.
        </p>

        {/* How it works */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">How it works</h3>
          <ol className="space-y-2.5 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">1</span>
              <span>Enter your business name, address, and contact details (saved for next time in your browser).</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">2</span>
              <span>Add supplier name and delivery address — or select a saved supplier.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">3</span>
              <span>Add line items: material description, quantity, unit, and unit price. The PO calculates totals automatically.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">4</span>
              <span>Set delivery date, job reference, and any notes for the supplier.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">5</span>
              <span>Download as PDF and email to your supplier. Done.</span>
            </li>
          </ol>
        </div>

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
              <li><Link href="/free-quote-generator" className="text-[#BD4A1A] hover:text-[#BD4A1A]">Free Quote Generator</Link></li>
              <li><Link href="/free-invoice-generator" className="text-[#BD4A1A] hover:text-[#BD4A1A]">Free Invoice Generator</Link></li>
              <li><Link href="/free-roofing-takeoff-builder" className="text-[#BD4A1A] hover:text-[#BD4A1A]">Roof Takeoff Builder</Link></li>
              <li><Link href="/free-roofing-calculator" className="text-[#BD4A1A] hover:text-[#BD4A1A]">Roofing Calculator</Link></li>
              <li><Link href="/free-tools" className="text-[#BD4A1A] hover:text-[#BD4A1A]">All Free Tools</Link></li>
            </ul>
          </div>
        </div>

        {/* Why use a PO */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Why use a purchase order?</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            A purchase order (PO) is a formal document sent to a supplier that confirms quantities, prices, and delivery details for materials you are ordering.
            For trades contractors, a PO creates a paper trail that protects both you and the supplier — if there is a dispute about pricing, quantities, or delivery,
            the PO is the reference point. Many suppliers require a PO number before they will dispatch materials.
            A professional PO also speeds up the ordering process — the supplier has everything they need in one document, rather than a phone call followed by a text with half the details.
          </p>
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
