import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Free Quote Generator | QuoteCore+',
  description:
    'Free online quote generator for roofing and construction. Create professional quotes with line items, VAT, and terms. No signup required - download as PDF.',
  openGraph: {
    title: 'Free Quote Generator - Create Professional Quotes Online',
    description: 'Create professional roofing and construction quotes in minutes. No signup required.',
    url: `${SITE_URL}/free-quote-generator`,
    type: 'website',
    images: [{ url: '/og-image.png', alt: 'Free Quote Generator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Quote Generator - Create Professional Quotes Online',
    description: 'Create professional roofing and construction quotes in minutes. No signup required.',
    images: ['/og-image.png'],
  },
  alternates: { canonical: `${SITE_URL}/free-quote-generator` },
};

const webAppLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Quote Generator',
  description: 'Free online quote generator for roofing and construction trades. Create professional quotes with line items, tax calculations, and PDF download. No signup required.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  url: `${SITE_URL}/free-quote-generator`,
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Free Tools', item: `${SITE_URL}/free-tools` },
    { '@type': 'ListItem', position: 2, name: 'Quote Generator', item: `${SITE_URL}/free-quote-generator` },
  ],
};

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is the quote generator really free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The QuoteCore+ free quote generator is completely free with no signup required. Create unlimited quotes, download as PDF, and send to customers. No watermark, no hidden fees.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need to create an account?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No account is needed. You can create and download a professional quote immediately. If you want to save quotes, track approvals, or import components from QuoteCore+, you can sign up for a free trial.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I add my logo and business details?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The quote generator lets you add your business name, logo, contact details, tax rates, and terms and conditions. Your quote will look like it came from your own software.',
      },
    },
    {
      '@type': 'Question',
      name: 'What format is the downloaded quote?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Quotes download as a professional PDF document, ready to email or print for your customer.',
      },
    },
  ],
};

const faqs = [
  { q: 'Is the quote generator really free?', a: 'Yes. Create unlimited quotes, download as PDF, and send to customers. No watermark, no hidden fees.' },
  { q: 'Do I need to create an account?', a: 'No account is needed. Create and download a professional quote immediately. Sign up for a free trial if you want to save quotes, track approvals, or import components.' },
  { q: 'Can I add my logo and business details?', a: 'Yes. Add your business name, logo, contact details, tax rates, and terms. Your quote looks like it came from your own software.' },
  { q: 'What format is the downloaded quote?', a: 'Quotes download as a professional PDF document, ready to email or print.' },
];

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {children}
      {/* Server-rendered SEO content */}
      <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mb-4">About the Free Quote Generator</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          The QuoteCore+ free quote generator helps trades contractors create professional quotes in minutes.
          Add line items with quantities and pricing, apply tax rates, include your business branding, and download as PDF.
          No signup, no email required, no watermark. Built by trades, for trades.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">What you can do</h3>
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li>Build quotes line by line with full pricing control</li>
              <li>AI-assisted quoting from photos or text input</li>
              <li>Add your logo, business details and terms</li>
              <li>Set tax rates and discounts</li>
              <li>Download as professional PDF</li>
              <li>Pre-fill from URL parameters</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Related tools</h3>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/free-invoice-generator" className="text-[#BD4A1A] hover:text-[#BD4A1A]">Free Invoice Generator</Link></li>
              <li><Link href="/free-purchase-order-generator" className="text-[#BD4A1A] hover:text-[#BD4A1A]">Free Purchase Order Generator</Link></li>
              <li><Link href="/free-roofing-calculator" className="text-[#BD4A1A] hover:text-[#BD4A1A]">Roofing Calculator</Link></li>
              <li><Link href="/free-roofing-takeoff-builder" className="text-[#BD4A1A] hover:text-[#BD4A1A]">Roof Takeoff Builder</Link></li>
              <li><Link href="/free-tools" className="text-[#BD4A1A] hover:text-[#BD4A1A]">All Free Tools</Link></li>
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
