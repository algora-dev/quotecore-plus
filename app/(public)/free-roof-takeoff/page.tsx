import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ToolEntryChoice } from './ToolEntryChoice';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { buildFaqSchema } from '@/lib/schema';
import './free-takeoff-ui.css';

const SITE_URL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Free Roof Takeoff & Measurement Tool - Upload Plans Online | QuoteCore+',
  description:
    'Free roof takeoff and measurement tool. Upload a roof plan image, set the scale and measure roof areas, ridges, hips, valleys and eaves in metric, imperial or roofing squares. No signup required.',
  alternates: { canonical: '/free-roof-takeoff' },
  openGraph: {
    title: 'Free Roof Takeoff & Measurement Tool - Upload Plans Online | QuoteCore+',
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
      'Yes. You can upload a plan, measure it and print the report without an account or payment details. Save to QuoteCore+ is an optional next step.',
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
      'Roof areas, ridges, hips, valleys, barges and verges, spouting/guttering lines, and custom lengths. Pitch is applied where the component requires it: standard ridges and spouting do not receive a pitch adjustment.',
  },
  {
    question: 'Can I upload a PDF roof plan?',
    answer:
      'Yes. Upload a PDF up to 50 MB and choose a page. You can also use PNG, JPG or WebP images up to 10 MB. Set the scale from a known dimension before measuring.',
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
      'Your measurements stay in the current browser session until you choose Save to QuoteCore+. Leaving or refreshing can clear unsaved work. Print the report or choose the save option on the results screen to keep your result.',
  },
  {
    question: 'Can I turn my takeoff into a material estimate or quote?',
    answer:
      'The output includes quantities and pricing when you add your own component rates. You can open the free quote generator with those lines, or save the takeoff to continue in a QuoteCore+ account.',
  },
  {
    question: 'Does the free roof takeoff use AI?',
    answer:
      'You can draw measurements manually. The current tool also offers AI Scan Assist when available, subject to the device credits shown in the tool. AI assistance processes your plan to suggest measurements; check the scale, outlines and results before using them.',
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
  'Upload plans or satellite imagery',
  'Print your measurement report',
];

const MEASUREMENTS = [
  ['Roof areas', 'Pitch-calculated true roof surface area from plan areas'],
  ['Ridges', 'Ridge length without a pitch adjustment for the standard component'],
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
  ['Custom components with your pricing', 'Up to 7', 'Reusable saved libraries'],
  ['AI Scan Assist', 'Subject to device credits', 'Yes'],
  ['Materials, ordering & invoicing', 'No', 'Yes'],
  ['Save takeoffs & manage jobs', 'Optional handoff to a QuoteCore+ account', 'Yes'],
];

export default async function FreeRoofTakeoffPage({
  searchParams,
}: {
  searchParams?: Promise<{ engine?: string }>;
}) {
  // Legacy engine links (?engine=v1) pointed at this URL when the takeoff
  // tool lived here - forward them to the tool's new home so A/B links
  // keep working.
  const params = (await searchParams) ?? {};
  if (params.engine) redirect(`/free-roof-takeoff/measure?engine=${params.engine}`);
  return (
    <div data-qc-ui="v2" className="qc-free-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <BlogHeader />

      {/* Compact entry: the setup task is visible without a second full-screen hero. */}
      <section className="qc-free-page-intro">
        <h1>Free Roof Takeoff &amp; Measurement Tool</h1>
        <p>Upload a roof plan or an overhead image, set the scale and measure. Get a clear report of your roof areas and lengths, without signing up.</p>
        <ul>{TRUST_POINTS.map(point => <li key={point}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" /></svg>{point}
        </li>)}</ul>
      </section>

      {/* Entry choice (owner 2026-10-03): price from existing measurements
          (actual vs plan) or measure a plan in the browser. The takeoff tool
          itself now lives at /free-roof-takeoff/measure. */}
      <div id="free-roof-takeoff" className="scroll-mt-24">
        <ToolEntryChoice />
      </div>

      {/* Example output */}
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 pt-14">
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
        <p className="mt-2 text-xs text-slate-500">Illustrative example - your results come from your own measurements. Need materials and pricing too? Add your own component rates here, or{' '}
          <Link href="/measurement-to-quote-tool" className="text-[#BD4A1A] underline underline-offset-2">turn measurements from any source into pricing</Link>{' '}with the Measurement-to-Quote tool.</p>
      </section>

      {/* What can you measure */}
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 pt-14">
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
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How it works</h2>
        <div className="mt-6 grid gap-6">
          {[
            ['Choose your measurement units', 'Metric (metres), imperial (feet) or roofing squares. Pitch can be entered as degrees or a ratio.'],
            ['Use default components or create up to 7 of your own', 'Defaults give pitch-calculated measurements and totals. Custom components can carry your pricing and waste logic.'],
            ['Upload your roof plan', 'Choose an image (PNG, JPG or WebP) or a page from a PDF. Calibrate the scale from a known dimension.'],
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
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What is a roof takeoff?</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          A roof takeoff is the process of measuring a roof from a drawing, image or plan to determine roof areas and key
          lengths such as ridges, hips, valleys and eaves. These measurements can then be used to calculate roofing
          materials, labour, pricing and quotations. QuoteCore Plus&rsquo;s free roof takeoff tool lets you perform the
          measurement stage directly in your browser without creating an account first.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          In the U.S. and Canada this workflow may be called a roof takeoff, roof measurement, roofing quantity takeoff
          or roof estimating from plans - in the UK, Australia and New Zealand, a roof take-off or roof plan measurement.
          QuoteCore+ supports imperial units (square feet, linear feet), pitch ratios like 6:12 and roofing squares, as
          well as metric.
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
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">You stay in control of every measurement</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Set the drawing scale and check each measurement against your plan. Draw areas and lengths yourself, or review
          the suggestions from AI Scan Assist when you use it. Stop printing roof
          plans just to measure them - upload the drawing, set the scale and measure roof areas and lengths directly in
          your browser instead of working between printed plans, a ruler, calculator and spreadsheet.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Wondering about remote measuring? See the{' '}
          <Link href="/research/google-earth-roof-measurement-accuracy" className="text-[#BD4A1A] underline underline-offset-2">Google Earth roof measurement accuracy study</Link>.{' '}
          Want the full walkthrough? See <Link href="/blog/how-to-measure-a-roof-online" className="text-[#BD4A1A] underline underline-offset-2">how to measure a roof online, step by step</Link>{' '}
          - uploading, calibrating the scale and measuring every component. From there, turn quantities into a
          materials order with the{' '}
          <Link href="/free-roofing-material-calculator" className="text-[#BD4A1A] underline underline-offset-2">free roofing material calculator</Link>{' '}
          or build the quote itself with the{' '}
          <Link href="/free-quote-generator" className="text-[#BD4A1A] underline underline-offset-2">free quote generator</Link>.
        </p>
      </section>

      {/* Free tool vs QuoteCore+ */}
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 pb-14">
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
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 pb-14">
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
            <Link href="/signup" className="text-[#BD4A1A] underline underline-offset-2">QuoteCore+ workflow</Link>.
          </li>
        </ul>
      </section>

      {/* GEO fact block */}
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">About the Free Roof Takeoff Tool</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          QuoteCore Plus&rsquo;s Free Roof Takeoff Tool is a browser-based roof plan measurement tool for roofers,
          estimators and contractors. It allows users to upload a roof plan, calibrate the drawing scale, and manually
          measure supported roof areas and linear features. The tool can be used without creating an account. Users who
          want to save their takeoff or continue into the wider QuoteCore+ estimating and quoting workflow can create a
          QuoteCore+ account afterward. Keep this page open while you measure, then print the report or choose to save
          the takeoff. AI Scan Assist processes your plan when you use it.
        </p>
      </section>

      {/* FAQ */}
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 pb-16">
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
      <section className="qc-free-page-information mx-auto max-w-3xl px-4 pb-20 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Measure your next roof plan for free</h2>
        <p className="mt-2 text-sm text-slate-600">No signup required to start.</p>
        <Link
          href="#free-roof-takeoff"
          data-qc-variant="primary" className="qc-button mt-5"
        >
          Start a free roof takeoff
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
