import type { Metadata } from 'next';
import Link from 'next/link';
import { FlooringTakeoff } from './FlooringTakeoff';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { buildFaqSchema } from '@/lib/schema';

const SITE_URL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Free Flooring Takeoff Tool — Measure Floor Plans Online',
  description:
    'Upload your plans and measure floor areas free. Calibrate the scale, trace rooms, count planks, carpet, tile, underlay, skirting and scotia. Export quantities. No printing, no scale ruler.',
  alternates: { canonical: '/free-flooring-takeoff' },
  openGraph: {
    title: 'Free Flooring Takeoff Tool — Measure Floor Plans Online',
    description:
      'Calibrate the scale on your floor plan and measure floor areas, timber plank, carpet, tile, underlay, skirting and scotia directly on screen. Free, no signup required.',
    url: '/free-flooring-takeoff',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    question: 'Is the QuoteCore Plus free flooring takeoff tool really free?',
    answer:
      'Yes. The free flooring takeoff tool is completely free with no signup required. There is no account, no payment details, and nothing is saved - each session starts fresh.',
  },
  {
    question: 'Do I need to create an account?',
    answer:
      'No. You can upload a plan, measure it, and get the full output without an account. An account is only needed if you want to save a takeoff and continue into the QuoteCore+ app.',
  },
  {
    question: 'What is a flooring takeoff?',
    answer:
      'A flooring takeoff is the process of measuring floors from a drawing, image or plan to determine floor areas and key lengths such as skirting, scotia and transition strips. These measurements are then used to calculate materials, labour, pricing and quotations.',
  },
  {
    question: 'What floor measurements can I take?',
    answer:
      'Floor areas for timber plank, carpet and tile, underlay areas, skirting and scotia runs, transition strips, single items such as adhesive buckets and sundries, and custom lengths or areas for any material.',
  },
  {
    question: 'Can I upload a PDF plan?',
    answer:
      'Yes. Upload a multi-page PDF (e.g. council or architect plans) up to 50 MB and pick the page you need — it converts to an image automatically. PNG, JPG and WebP images (up to 10 MB) are also supported.',
  },
  {
    question: 'Can I use my own flooring components and prices?',
    answer:
      'Yes. Instead of the standard placeholder components, you can build up to 7 custom components with your own measurement types, material and labour rates, pack pricing and waste. The output then shows priced quantities for each.',
  },
  {
    question: 'Does it work for any floor covering?',
    answer:
      'Yes. The tool does not assume a material - timber plank, carpet, tile, vinyl, hybrid, laminate, whatever you are pricing. Build components that match your materials and measure any room or floor plan.',
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
  name: 'Free Flooring Takeoff',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web browser (desktop recommended)',
  url: `${SITE_URL}/free-flooring-takeoff`,
  description:
    'QuoteCore Plus Free Flooring Takeoff Tool. Upload a floor plan, calibrate the drawing scale, and measure floor areas, skirting, scotia and transition runs directly in your browser. No signup required.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Free Flooring Takeoff', item: `${SITE_URL}/free-flooring-takeoff` },
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
  ['Timber plank areas', 'Trace each room to get plank flooring areas straight off the plan'],
  ['Carpet areas', 'Carpet zones measured room by room'],
  ['Tile areas', 'Tile floors, kitchens, bathrooms and entries by area'],
  ['Underlay', 'Full coverage underlay areas under any floor covering'],
  ['Skirting & scotia', 'Perimeter runs by length around every room'],
  ['Transition strips', 'Doorway and material-change trims by length'],
  ['Single items', 'Adhesive buckets, sundries and fixings priced per item'],
];

export default function FreeFlooringTakeoffPage() {
  return (
    <div className="bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <BlogHeader />

      {/* H1 + hero + trust strip (above the tool) */}
      <section className="mx-auto max-w-3xl px-4 pt-10 pb-6 text-center md:pt-14">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Free Flooring Takeoff Tool — Measure Your Plan Online
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Upload a floor plan, set the drawing scale, and measure floor areas, plank, carpet, tile, underlay, skirting
          and scotia directly in your browser. Works for any floor covering. No signup required.
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
      <div id="free-flooring-takeoff" className="scroll-mt-24">
        <FlooringTakeoff />
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
            ['Choose your measurement units', 'Metric (metres) or imperial (feet). Floor areas are measured as drawn - no pitch to worry about.'],
            ['Upload your plan', 'An image of your floor plan (PNG, JPG, WebP), or the whole PDF — upload up to 50 MB and pick the page you need. Calibrate the scale from any known dimension such as a wall length.'],
            ['Use default flooring components or create up to 7 of your own', 'Defaults cover timber plank, carpet, tile, underlay, skirting, scotia, transition strips and sundries. Custom components can carry your pricing and waste logic for any material.'],
            ['Measure your floors', 'Draw areas and lengths directly on your calibrated plan - floor areas, skirting runs, scotia lines, transition positions.'],
            ['Review and finish', 'Get the full output: floor areas, component totals, and pricing if you added your own rates. Save or continue in QuoteCore+ - optional.'],
          ].map(([title, body], i) => (
            <div key={title}>
              <h3 className="text-base font-semibold text-slate-900">{i + 1}. {title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to measure floors from plans */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How to measure floors from plans</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Upload or screenshot your plan, calibrate the scale from any known dimension (a wall length, a door width),
          then trace each room as a polygon. Add up the rooms, split by material (plank vs carpet vs tile), and you
          have floor areas without printing anything or reaching for a scale ruler. The full walkthrough — including
          scale checks and worked examples — is in our{' '}
          <Link href="/blog/how-to-measure-pdf-plans" className="text-[#BD4A1A] underline underline-offset-2">complete PDF plan measuring guide</Link>.
        </p>
        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900">How to measure skirting and scotia</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Skirting, scotia and transition strips are lineal runs — trace them along the walls on your calibrated plan
          and the tool totals each run in metres or feet. Deduct doorways where trim is not needed, and remember
          wardrobe and joinery lines if they get trim too. Waste can be applied as a percentage when you build your
          own components.
        </p>
      </section>

      {/* Gross vs usable floor area */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Gross vs usable floor area</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          <strong>Gross floor area</strong> is the room as drawn — wall to wall. <strong>Usable (net) floor area</strong>
          subtracts fixed joinery, hearths, stairs and cabinetry that the floor covering does not go under. Order
          plank, carpet and tile from usable area plus a waste allowance (typically 5-10% for plank, more for tile
          with a diagonal layout). In this tool, trace the room first, then deduct the fixed items — so you always
          keep both numbers.
        </p>
      </section>

      {/* Irregular rooms */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Irregular and open-plan rooms</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Raked rooms, angled walls, alcoves and open-plan living areas are just polygons — trace each vertex on the
          plan and the tool computes the area. No splitting into rectangles, no triangle formulas. Measure each
          material zone separately so plank, carpet and tile totals stay clean.
        </p>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Who it&rsquo;s for</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Flooring installers and retailers, builders, renovators, estimators and quantity surveyors, carpet and tile
          layers, interior designers — and homeowners checking a flooring quote. If your job starts with a plan and
          ends in m² or metres, this tool is for you.
        </p>
      </section>

      {/* Measurement methodology */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Measurement methodology</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          All measurements in this tool are based on the plan scale you calibrate: you set the scale from a known
          dimension on your drawing, and every traced area, length and item count is then calculated from that
          calibrated scale. Areas are measured by tracing the boundary of each room or material zone on the drawing;
          fixed joinery can be traced and deducted separately, and every measurement can be named and labelled by
          material so totals stay organised. Accuracy depends on the quality of the plan image and the calibration —
          always check the scale against a second known dimension before measuring. Final quantities, waste
          allowances and adhesive or fixing requirements should be verified against your specifications and the
          manufacturer&rsquo;s installation requirements before ordering.
        </p>
      </section>

      {/* What is a flooring takeoff */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What is a flooring takeoff?</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          A flooring takeoff is the process of measuring floors from a drawing, image or plan to determine floor areas
          and key lengths such as skirting, scotia and transition strips. These measurements can then be used to
          calculate materials, labour, pricing and quotations. QuoteCore Plus&rsquo;s free tool handles the measurement
          stage directly in your browser - timber plank, carpet, tile, any material.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Finished measuring? <strong>Turn your measurements into a quote</strong> with the{' '}
          <Link href="/measurement-to-quote-tool" className="text-[#BD4A1A] underline underline-offset-2">free Measurement-to-Quote Tool</Link>, or
          send quantities straight to the{' '}
          <Link href="/free-quote-generator" className="text-[#BD4A1A] underline underline-offset-2">free quote generator</Link>.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Measuring a roof or walls? Try the{' '}
          <Link href="/free-roof-takeoff" className="text-[#BD4A1A] underline underline-offset-2">Free Roof Takeoff Tool</Link> or the{' '}
          <Link href="/free-cladding-takeoff" className="text-[#BD4A1A] underline underline-offset-2">Free Wall &amp; Cladding Takeoff Tool</Link> — the
          same workflow for roof and wall measurements.
        </p>
      </section>

      {/* Related free tools */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Related free tools</h2>
        <ul className="mt-4 grid gap-3 text-sm text-slate-600">
          <li><Link href="/free-roof-takeoff" className="text-[#BD4A1A] underline underline-offset-2">Free Roof Takeoff Tool</Link> — measure roof areas from a plan</li>
          <li><Link href="/free-cladding-takeoff" className="text-[#BD4A1A] underline underline-offset-2">Free Wall &amp; Cladding Takeoff Tool</Link> — measure walls, cladding and trims</li>
          <li><Link href="/measurement-to-quote-tool" className="text-[#BD4A1A] underline underline-offset-2">Measurement-to-Quote Tool</Link> — turn these measurements into a priced quote</li>
          <li><Link href="/free-flooring-calculator" className="text-[#BD4A1A] underline underline-offset-2">Flooring Calculator</Link> — already know your dimensions</li>
          <li><Link href="/free-quote-generator" className="text-[#BD4A1A] underline underline-offset-2">Free Quote Generator</Link> — send the customer a quote</li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Free flooring takeoff FAQ</h2>
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
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Measure your next floor plan for free</h2>
        <p className="mt-2 text-sm text-slate-600">No signup required to start.</p>
        <Link
          href="#free-flooring-takeoff"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-black px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          Start a free flooring takeoff
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
