import type { Metadata } from 'next';
import Link from 'next/link';
import { FreeRoofTakeoff } from './FreeRoofTakeoff';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { buildFaqSchema } from '@/lib/schema';

const SITE_URL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Free Roof Takeoff Tool | Measure Roof Plans Online | QuoteCore Plus',
  description:
    'Measure roof plans online for free. Upload a plan, set the scale and calculate roof areas, ridges, hips, valleys and other dimensions. No signup required.',
  alternates: { canonical: '/free-roof-takeoff' },
  openGraph: {
    title: 'Free Roof Takeoff Tool | Measure Roof Plans Online | QuoteCore Plus',
    description:
      'Upload your own roof plan, measure with pitch calculations, and get a full measurement output. Free, no signup required.',
    url: '/free-roof-takeoff',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    question: 'Is the QuoteCore Plus free roof takeoff tool really free?',
    answer:
      'Yes. The QuoteCore Plus free roof takeoff tool is completely free with no signup required. There is no account, no payment details, and nothing is saved - each session starts fresh.',
  },
  {
    question: 'Do I need to create an account?',
    answer:
      'No. You can upload a plan, measure it, and get the full output without an account. An account is only needed if you want to save a takeoff and continue into the QuoteCore+ app.',
  },
  {
    question: 'What is a roof takeoff?',
    answer:
      'A roof takeoff is the process of measuring a roof from a drawing, image or plan to determine roof areas and key lengths such as ridges, hips, valleys and eaves. These measurements are then used to calculate roofing materials, labour, pricing and quotations.',
  },
  {
    question: 'What roof measurements can I take?',
    answer:
      'Roof areas, ridges, hips, valleys, barges and verges, spouting/guttering lines, and custom lengths. Every length is pitch-calculated, so plan measurements convert to true roof measurements automatically.',
  },
  {
    question: 'Can I upload a PDF roof plan?',
    answer:
      'Not yet. The tool currently accepts plan images in PNG, JPG or WebP format. Most PDF plans can be exported or screenshotted as an image. Calibrate the scale from any known dimension and every measurement is to scale.',
  },
  {
    question: 'How do I set the scale of the drawing?',
    answer:
      'After uploading, draw a line along any dimension you know the true length of (a wall, a scale bar) and enter that length. The tool calibrates from it and every subsequent measurement is to scale.',
  },
  {
    question: 'Can I measure in metric, imperial or roofing squares?',
    answer:
      'Yes. Choose metric (metres), imperial (feet) or roofing squares at the start. Imperial and roofing squares users can enter roof pitch as degrees or as a ratio like 6:12.',
  },
  {
    question: 'Are my plans or measurements saved?',
    answer:
      'No. Nothing is saved and the session refreshes every time you leave. Your plan is used only for that takeoff session. If you want to keep a result, send it into the QuoteCore+ app from the output screen.',
  },
  {
    question: 'Can I turn my takeoff into a material estimate or quote?',
    answer:
      'The output includes quantities and pricing if you build custom components with your own rates. From the output screen you can send the result into QuoteCore+, create a free account, and continue into materials, pricing and quoting.',
  },
  {
    question: 'Does the free roof takeoff use AI?',
    answer:
      'No. Measuring in this free tool is manual - you draw each measurement on your own plan, so every result can be visually checked. AI Scan Assist, which scans plans automatically, is part of the full QuoteCore+ app.',
  },
];

const faqSchema = buildFaqSchema(FAQS);

const webAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Roof Takeoff',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web browser (desktop recommended)',
  url: `${SITE_URL}/free-roof-takeoff`,
  description:
    'QuoteCore Plus Free Roof Takeoff Tool. Upload a roof plan, calibrate the drawing scale, and manually measure roof areas, ridges, hips, valleys and eaves directly in your browser. No signup required.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Free Roof Takeoff', item: `${SITE_URL}/free-roof-takeoff` },
  ],
};

const TRUST_POINTS = [
  'Free to use',
  'No signup required',
  'No credit card',
  'Metric, imperial & roofing squares',
  'Nothing saved unless you continue in QuoteCore+',
];

const MEASUREMENTS = [
  ['Roof areas', 'Pitch-calculated true roof surface area from plan areas'],
  ['Ridges', 'Total ridge length, converted for pitch where applicable'],
  ['Hips & valleys', 'Diagonal hip and valley lengths with pitch factors applied'],
  ['Barges & verges', 'Sloping edge lengths on gable ends'],
  ['Eaves & spouting', 'Perimeter and guttering line lengths'],
  ['Custom lengths', 'Any other linear measurement, in your chosen units'],
];

const EXAMPLE_OUTPUT: [string, string][] = [
  ['Roof area', '126.4 m²'],
  ['Ridge', '18.2 m'],
  ['Hips', '21.6 m'],
  ['Valleys', '8.4 m'],
  ['Eaves', '32.8 m'],
];

const COMPARISON: [string, string, string][] = [
  ['Upload & measure your own plan', 'Yes', 'Yes'],
  ['Pitch-calculated measurements', 'Yes', 'Yes'],
  ['Custom components with your pricing', 'Up to 7', 'Unlimited, saved libraries'],
  ['AI Scan Assist', 'No - manual measuring', 'Yes'],
  ['Materials, ordering & invoicing', 'No', 'Yes'],
  ['Save takeoffs & manage jobs', 'No - session only', 'Yes'],
];

export default function FreeRoofTakeoffPage() {
  return (
    <div className="bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <BlogHeader />

      {/* H1 + hero + trust strip (above the tool) */}
      <section className="mx-auto max-w-3xl px-4 pt-10 pb-6 text-center md:pt-14">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Free Roof Takeoff Tool — Measure Your Roof Plan Online
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          The QuoteCore Plus free roof takeoff lets you upload a roof plan, set the drawing scale, and measure roof
          areas, ridges, hips, valleys, eaves and other roof dimensions directly in your browser. No signup required.
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
      <div id="free-roof-takeoff" className="scroll-mt-24">
        <FreeRoofTakeoff />
      </div>

      {/* Example output */}
      <section className="mx-auto max-w-3xl px-4 pt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What the finished takeoff looks like</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Your output lists every measurement with its pitch calculation, totals per component, and pricing if you added
          your own rates. Example values from a typical finished takeoff:
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <tbody>
              {EXAMPLE_OUTPUT.map(([label, value]) => (
                <tr key={label} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 text-slate-600">{label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Illustrative example - your results come from your own measurements.</p>
      </section>

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

      {/* How it works (real steps) */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How it works</h2>
        <div className="mt-6 grid gap-6">
          {[
            ['Choose your measurement units', 'Metric (metres), imperial (feet) or roofing squares. Pitch can be entered as degrees or a ratio.'],
            ['Upload your roof plan', 'An image of your plan (PNG, JPG or WebP). Calibrate the scale from any known dimension.'],
            ['Use default components or create up to 7 of your own', 'Defaults give pitch-calculated measurements and totals. Custom components can carry your pricing and waste logic.'],
            ['Measure your roof', 'Draw lengths and areas directly on your calibrated plan - ridges, hips, valleys, barges, eaves.'],
            ['Review and finish', 'Get the full output: pitch-calculated measurements, totals, component quantities, and pricing if you added it. Save or continue in QuoteCore+ - optional.'],
          ].map(([title, body], i) => (
            <div key={title}>
              <h3 className="text-base font-semibold text-slate-900">{i + 1}. {title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What is a roof takeoff + takeoff vs estimating */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What is a roof takeoff?</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          A roof takeoff is the process of measuring a roof from a drawing, image or plan to determine roof areas and key
          lengths such as ridges, hips, valleys and eaves. These measurements can then be used to calculate roofing
          materials, labour, pricing and quotations. QuoteCore Plus&rsquo;s free roof takeoff tool lets you perform the
          measurement stage directly in your browser without creating an account first.
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Roof takeoff vs roof estimating</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            A takeoff measures the roof and produces areas and lengths. Estimating uses those measurements to calculate
            materials, labour and price. This free tool handles the measurement stage; QuoteCore+ can then carry those
            measurements into the wider{' '}
            <Link href="/roofing-estimating-software" className="text-[#BD4A1A] underline underline-offset-2">
              estimating and quoting workflow
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Manual measurement trust positioning + alternative to printing */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">You stay in control of every measurement</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The free roof takeoff tool does not guess your roof geometry for you. You set the drawing scale and measure the
          roof areas and lengths yourself, so every result can be visually checked against the plan. Stop printing roof
          plans just to measure them - upload the drawing, set the scale and measure roof areas and lengths directly in
          your browser instead of working between printed plans, a ruler, calculator and spreadsheet.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Want the full walkthrough? See <Link href="/blog/how-to-measure-a-roof-online" className="text-[#BD4A1A] underline underline-offset-2">how to measure a roof online, step by step</Link>{' '}
          - uploading, calibrating the scale and measuring every component. From there, turn quantities into a
          materials order with the{' '}
          <Link href="/free-roofing-material-calculator" className="text-[#BD4A1A] underline underline-offset-2">free roofing material calculator</Link>{' '}
          or build the quote itself with the{' '}
          <Link href="/free-quote-generator" className="text-[#BD4A1A] underline underline-offset-2">free quote generator</Link>.
        </p>
      </section>

      {/* Free tool vs QuoteCore+ */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Free tool vs QuoteCore+</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-semibold text-slate-900">Capability</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Free roof takeoff</th>
                <th className="px-4 py-3 font-semibold text-slate-900">QuoteCore+ app</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([label, free, app]) => (
                <tr key={label} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 text-slate-600">{label}</td>
                  <td className="px-4 py-2.5 text-slate-900">{free}</td>
                  <td className="px-4 py-2.5 text-slate-900">{app}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Ready to price or quote? See{' '}
          <Link href="/roofing-takeoff-software" className="text-[#BD4A1A] underline underline-offset-2">roofing takeoff software</Link>{' '}
          or{' '}
          <Link href="/pricing" className="text-[#BD4A1A] underline underline-offset-2">plans and pricing</Link>.
        </p>
      </section>

      {/* Related free tools */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Which tool do you need?</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <strong className="text-slate-900">I have a plan or drawing and need to measure it.</strong> You&rsquo;re in
            the right place - this is the Free Roof Takeoff tool.
          </li>
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <strong className="text-slate-900">I need to measure walls, cladding or façades from a plan.</strong> Use the{' '}
            <Link href="/free-cladding-takeoff" className="text-[#BD4A1A] underline underline-offset-2">Free Wall &amp; Cladding Takeoff Tool</Link>{' '}
            - same workflow, wall and cladding components.
          </li>
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <strong className="text-slate-900">I already have my measurements and need quantities.</strong> Use the{' '}
            <Link href="/free-roofing-takeoff-builder" className="text-[#BD4A1A] underline underline-offset-2">roof takeoff builder</Link>{' '}
            or the{' '}
            <Link href="/free-roofing-takeoff-calculator" className="text-[#BD4A1A] underline underline-offset-2">roof takeoff calculator</Link>.
          </li>
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <strong className="text-slate-900">I already have measurements and need pricing with my own rates.</strong> Use the{' '}
            <Link href="/measurement-to-quote-tool" className="text-[#BD4A1A] underline underline-offset-2">Measurement-to-Quote Tool</Link>{' '}
            - reusable pricing components, free, no signup required.
          </li>
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <strong className="text-slate-900">I want to go from measure to quote to job management.</strong> That&rsquo;s
            the full{' '}
            <Link href="/free-trial" className="text-[#BD4A1A] underline underline-offset-2">QuoteCore+ workflow</Link>.
          </li>
        </ul>
      </section>

      {/* GEO fact block */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">About the Free Roof Takeoff Tool</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          QuoteCore Plus&rsquo;s Free Roof Takeoff Tool is a browser-based roof plan measurement tool for roofers,
          estimators and contractors. It allows users to upload a roof plan, calibrate the drawing scale, and manually
          measure supported roof areas and linear features. The tool can be used without creating an account. Users who
          want to save their takeoff or continue into the wider QuoteCore+ estimating and quoting workflow can create a
          free account afterward. Your plan is used for this takeoff session - nothing is saved unless you choose to
          save or continue.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Free roof takeoff FAQ</h2>
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
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Measure your next roof plan for free</h2>
        <p className="mt-2 text-sm text-slate-600">No signup required to start.</p>
        <Link
          href="#free-roof-takeoff"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-black px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          Start a free roof takeoff
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
