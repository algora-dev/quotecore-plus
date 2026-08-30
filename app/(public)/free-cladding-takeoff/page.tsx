import type { Metadata } from 'next';
import Link from 'next/link';
import { CladdingTakeoff } from './CladdingTakeoff';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { buildFaqSchema } from '@/lib/schema';

const SITE_URL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Free Wall & Cladding Takeoff Tool | Measure Wall Plans Online | QuoteCore Plus',
  description:
    'Measure wall and cladding plans online for free. Upload an elevation or plan, set the scale and calculate wall areas, trims, battens and openings. No signup required.',
  alternates: { canonical: '/free-cladding-takeoff' },
  openGraph: {
    title: 'Free Wall & Cladding Takeoff Tool | Measure Wall Plans Online | QuoteCore Plus',
    description:
      'Upload your own wall or elevation plan, trace wall areas and trims, and get a full measurement output. Free, no signup required.',
    url: '/free-cladding-takeoff',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    question: 'Is the QuoteCore Plus free cladding takeoff tool really free?',
    answer:
      'Yes. The free wall & cladding takeoff tool is completely free with no signup required. There is no account, no payment details, and nothing is saved - each session starts fresh.',
  },
  {
    question: 'Do I need to create an account?',
    answer:
      'No. You can upload a plan, measure it, and get the full output without an account. An account is only needed if you want to save a takeoff and continue into the QuoteCore+ app.',
  },
  {
    question: 'What is a cladding takeoff?',
    answer:
      'A cladding takeoff is the process of measuring walls and elevations from a drawing, image or plan to determine wall areas and key lengths such as trims, battens and cladding runs. These measurements are then used to calculate materials, labour, pricing and quotations.',
  },
  {
    question: 'What wall measurements can I take?',
    answer:
      'Wall areas, building wrap and soffit areas, cavity batten runs, horizontal cladding areas (cedar, corrugate or your own), window and door trims, corner trims, opening counts, and custom lengths or areas for any material.',
  },
  {
    question: 'Can I upload a PDF plan?',
    answer:
      'Not yet. The tool currently accepts plan images in PNG, JPG or WebP format. Most PDF plans can be exported or screenshotted as an image. Calibrate the scale from any known dimension and every measurement is to scale.',
  },
  {
    question: 'Can I use my own cladding components and prices?',
    answer:
      'Yes. Instead of the standard placeholder components, you can build up to 7 custom components with your own measurement types, material and labour rates, pack pricing and waste. The output then shows priced quantities for each.',
  },
  {
    question: 'Does it work for internal walls or other materials?',
    answer:
      'Yes. The tool does not assume a material or wall type - external cladding, internal linings, screening, whatever you are pricing. Build components that match your materials and measure any wall or elevation.',
  },
  {
    question: 'Are my plans or measurements saved?',
    answer:
      'No. Nothing is saved and the session refreshes every time you leave. Your plan is used only for that takeoff session. If you want to keep a result, send it into the QuoteCore+ app from the output screen.',
  },
];

const faqSchema = buildFaqSchema(FAQS);

const webAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Wall & Cladding Takeoff',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web browser (desktop recommended)',
  url: `${SITE_URL}/free-cladding-takeoff`,
  description:
    'QuoteCore Plus Free Wall & Cladding Takeoff Tool. Upload an elevation or plan, calibrate the drawing scale, and manually measure wall areas, trims, battens and cladding runs directly in your browser. No signup required.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Free Wall & Cladding Takeoff', item: `${SITE_URL}/free-cladding-takeoff` },
  ],
};

const TRUST_POINTS = [
  'Free to use',
  'No signup required',
  'No credit card',
  'Metric & imperial',
  'Nothing saved unless you continue in QuoteCore+',
];

const MEASUREMENTS = [
  ['Wall areas', 'Trace any wall or elevation on your plan to get its area'],
  ['Building wrap & soffit', 'Full-surface areas straight off the elevation'],
  ['Cavity battens', 'Vertical or horizontal batten runs, by length'],
  ['Cladding areas', 'Cedar, corrugate or your own cladding, by area'],
  ['Window & door trims', 'Perimeter trim runs around every opening'],
  ['Corner trims', 'External and internal corner runs by length'],
  ['Openings', 'Count windows and doors priced per unit'],
];

export default function FreeCladdingTakeoffPage() {
  return (
    <div className="bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <BlogHeader />

      {/* H1 + hero + trust strip (above the tool) */}
      <section className="mx-auto max-w-3xl px-4 pt-10 pb-6 text-center md:pt-14">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Free Wall &amp; Cladding Takeoff Tool — Measure Your Plan Online
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Upload a wall elevation or plan, set the drawing scale, and measure wall areas, trims, battens and cladding
          runs directly in your browser. Works for any wall or cladding material. No signup required.
        </p>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {TRUST_POINTS.map(point => (
            <li key={point} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <svg className="h-4 w-4 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* The tool */}
      <div id="free-cladding-takeoff" className="scroll-mt-24">
        <CladdingTakeoff />
      </div>

      {/* What can you measure */}
      <section className="mx-auto max-w-3xl px-4 pt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What can you measure?</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {MEASUREMENTS.map(([label, desc]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-sm font-semibold text-slate-900">{label}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-slate-600">{desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How it works</h2>
        <div className="mt-6 grid gap-6">
          {[
            ['Choose your measurement units', 'Metric (metres) or imperial (feet). Wall areas are measured as drawn - no pitch to worry about.'],
            ['Upload your plan', 'An image of your elevation or plan (PNG, JPG or WebP). Calibrate the scale from any known dimension such as a wall length.'],
            ['Use default cladding components or create up to 7 of your own', 'Defaults cover wrap, battens, cladding, trims, soffit and openings. Custom components can carry your pricing and waste logic for any material.'],
            ['Measure your walls', 'Draw areas and lengths directly on your calibrated plan - wall areas, trim runs, batten lines, opening positions.'],
            ['Review and finish', 'Get the full output: wall areas, component totals, and pricing if you added your own rates. Save or continue in QuoteCore+ - optional.'],
          ].map(([title, body], i) => (
            <div key={title}>
              <h3 className="text-base font-semibold text-slate-900">{i + 1}. {title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What is a cladding takeoff */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What is a wall &amp; cladding takeoff?</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          A cladding takeoff is the process of measuring walls from a drawing, image or plan to determine wall areas and
          key lengths such as trims, battens and cladding runs. These measurements can then be used to calculate
          materials, labour, pricing and quotations. QuoteCore Plus&rsquo;s free tool handles the measurement stage
          directly in your browser - external walls, internal walls, any material.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Finished measuring? Turn quantities into a priced quote with the{' '}
          <Link href="/free-quote-generator" className="text-[#BD4A1A] underline underline-offset-2">free quote generator</Link>.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Free cladding takeoff FAQ</h2>
        <div className="mt-6 grid gap-6">
          {FAQS.map(faq => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold text-slate-900">{faq.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-4 pb-20 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Measure your next wall plan for free</h2>
        <p className="mt-2 text-sm text-slate-600">No signup required to start.</p>
        <Link
          href="#free-cladding-takeoff"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-black px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          Start a free cladding takeoff
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
