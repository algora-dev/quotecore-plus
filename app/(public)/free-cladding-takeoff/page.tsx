import type { Metadata } from 'next';
import Link from 'next/link';
import { CladdingTakeoff } from './CladdingTakeoff';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { buildFaqSchema } from '@/lib/schema';

const SITE_URL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Free Wall & Cladding Takeoff Tool — Measure Wall Plans Online',
  description:
    'Upload your plans and measure wall, cladding, siding and façade areas free. Calibrate the scale, trace areas, deduct openings, export quantities. No printing, no scale ruler.',
  alternates: { canonical: '/free-cladding-takeoff' },
  openGraph: {
    title: 'Free Wall & Cladding Takeoff Tool — Measure Wall Plans Online',
    description:
      'Calibrate the scale on your plan or elevation and measure wall areas, cladding, trims, battens and openings directly on screen. Free, no signup required.',
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
  ['Cavity battens', 'Full-surface batten coverage, by wall area'],
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

      {/* How to measure walls / cladding from plans (answer-first, link guides) */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How to measure walls from plans</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Upload or screenshot your plan, calibrate the scale from any known dimension (a wall length, a door width),
          then trace each wall area as a polygon. Add up the elevations, deduct windows and doors, and you have wall
          areas without printing anything or reaching for a scale ruler. The full walkthrough — including scale checks
          and worked examples — is in our{' '}
          <Link href="/blog/how-to-measure-walls-cladding-from-plans" className="text-[#BD4A1A] underline underline-offset-2">complete wall &amp; cladding takeoff guide</Link>.
        </p>
        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900">How to measure cladding from elevation plans</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Trace the cladding zones on each elevation as drawn — walls are measured flat, with no pitch factor to worry
          about. Deduct openings, separate materials (e.g. brick vs weatherboard vs render), and measure trims and
          battens as linear runs. See the{' '}
          <Link href="/blog/how-to-do-cladding-takeoff" className="text-[#BD4A1A] underline underline-offset-2">cladding takeoff guide</Link>{' '}
          for the full method, including waste and trims.
        </p>
      </section>

      {/* Gross vs net */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Gross vs net wall area</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          <strong>Gross wall area</strong> is the full elevation as drawn — width × height (plus gables).{' '}
          <strong>Net wall area</strong> subtracts openings: windows, doors, garage doors and vents. Cladding and
          sheet materials are usually ordered from net area (plus waste), while paint, render and membranes are often
          priced from gross area because you still coat the reveals. In this tool, trace the full wall first, then
          measure openings separately and deduct — so you always keep both numbers.
        </p>
      </section>

      {/* Gables and irregular shapes */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Gables and irregular shapes</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Gables, raked walls and stepped elevations are just polygons — trace each vertex on the plan and the tool
          computes the area. No splitting into rectangles, no triangle formulas. The same applies to angled walls,
          curved façades approximated with short segments, and irregular internal walls.
        </p>
      </section>

      {/* Multiple materials on one elevation */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Multiple materials on one elevation</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Real elevations rarely have one material. A typical house might be brick to the first floor, weatherboard
          above, a feature panel at the entry and render on the garage. Trace each material zone as its own area,
          name it, and the output totals each material separately — so cladding, trims and fixings order cleanly.
        </p>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Who it&rsquo;s for</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Builders, cladding / siding / façade contractors, estimators and quantity surveyors, painters and renderers,
          insulation installers, drywallers, sheet-material suppliers — and homeowners checking a quote. If your job
          starts with a plan and ends in m² or metres, this tool is for you.
        </p>
      </section>

      {/* Other things you can measure */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Other things you can measure</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The tool doesn&rsquo;t assume a material, so the same plan takeoff covers paint, render, insulation,
          waterproofing and membranes, drywall and sheet materials, trims and flashings — even fencing runs. Already
          have areas? Use the{' '}
          <Link href="/free-wall-area-calculator" className="text-[#BD4A1A] underline underline-offset-2">free wall area calculator</Link>{' '}
          or{' '}
          <Link href="/free-paint-calculator" className="text-[#BD4A1A] underline underline-offset-2">free paint calculator</Link>{' '}
          instead.
        </p>
      </section>

      {/* Measurement methodology */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Measurement methodology</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          All measurements in this tool are based on the plan scale you calibrate: you set the scale from a known
          dimension on your drawing, and every traced area, length and count is then calculated from that calibrated
          scale. Areas are measured by tracing the boundary of each wall, elevation or material zone on the drawing;
          openings such as windows and doors can be traced and deducted separately, and every measurement can be
          named and labelled by material so totals stay organised. Accuracy depends on the quality of the plan image
          and the calibration — always check the scale against a second known dimension before measuring. Final
          quantities, waste allowances and fixing requirements should be verified against your specifications and
          the manufacturer&rsquo;s installation requirements before ordering.
        </p>
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
          Finished measuring? <strong>Turn your measurements into a quote</strong> with the{' '}
          <Link href="/measurement-to-quote-tool" className="text-[#BD4A1A] underline underline-offset-2">free Measurement-to-Quote Tool</Link>, or
          send quantities straight to the{' '}
          <Link href="/free-quote-generator" className="text-[#BD4A1A] underline underline-offset-2">free quote generator</Link>.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Measuring a roof? Try the{' '}
          <Link href="/free-roofing-takeoff-builder" className="text-[#BD4A1A] underline underline-offset-2">Free Roof Takeoff Builder</Link> — the
          same workflow for roof measurements. Or read{' '}
          <Link href="/blog/how-to-measure-a-roof-from-a-pdf-plan" className="text-[#BD4A1A] underline underline-offset-2">how to measure a roof from a plan</Link>.
        </p>
      </section>

      {/* Related free tools */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Related free tools</h2>
        <ul className="mt-4 grid gap-3 text-sm text-slate-600">
          <li><Link href="/free-roofing-takeoff-builder" className="text-[#BD4A1A] underline underline-offset-2">Free Roof Takeoff Builder</Link> — build a roof takeoff from your measurements</li>
          <li><Link href="/measurement-to-quote-tool" className="text-[#BD4A1A] underline underline-offset-2">Measurement-to-Quote Tool</Link> — turn these measurements into a priced quote</li>
          <li><Link href="/free-wall-area-calculator" className="text-[#BD4A1A] underline underline-offset-2">Wall Area Calculator</Link> — already know your dimensions</li>
          <li><Link href="/free-paint-calculator" className="text-[#BD4A1A] underline underline-offset-2">Paint Calculator</Link> — paint quantities from wall areas</li>
          <li><Link href="/free-quote-generator" className="text-[#BD4A1A] underline underline-offset-2">Free Quote Generator</Link> — send the customer a quote</li>
        </ul>
      </section>

      {/* Measurement guides */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Complete measurement guides</h2>
        <ul className="mt-4 grid gap-3 text-sm text-slate-600">
          <li><Link href="/blog/how-to-measure-walls-cladding-from-plans" className="text-[#BD4A1A] underline underline-offset-2">How to measure walls &amp; cladding from plans</Link> — the full takeoff guide</li>
          <li><Link href="/blog/how-to-measure-pdf-plans" className="text-[#BD4A1A] underline underline-offset-2">How to measure anything from PDF plans</Link> — areas, lengths and quantities</li>
          <li><Link href="/blog/how-to-do-cladding-takeoff" className="text-[#BD4A1A] underline underline-offset-2">How to do a cladding takeoff</Link> — areas, openings and quantities</li>
        </ul>
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
