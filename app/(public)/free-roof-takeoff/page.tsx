import type { Metadata } from 'next';
import Link from 'next/link';
import { FreeRoofTakeoff } from './FreeRoofTakeoff';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { buildFaqSchema } from '@/lib/schema';
import { TrialCTA } from '@/app/(marketing)/takeoff-demo/TrialCTA';

const SITE_URL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Free Roof Takeoff — Upload Your Plan & Measure Online | QuoteCore Plus',
  description:
    'Upload your own roof plan and measure areas, ridges, hips and valleys with pitch calculations. Free digital takeoff tool, no signup required.',
  alternates: { canonical: '/free-roof-takeoff' },
  openGraph: {
    title: 'Free Roof Takeoff — Upload Your Plan & Measure Online | QuoteCore Plus',
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
    question: 'Do I need my own roof plan?',
    answer:
      'Yes. This tool works on your own plan - upload an image of it (PNG, JPG or WebP) and measure directly on screen. No plan handy? Use the takeoff demo with a sample roof plan instead.',
  },
  {
    question: 'Does it calculate pricing?',
    answer:
      'Only if you want it to. The default components give you pitch-calculated measurements and totals with no pricing. If you create your own components, you can add your own pricing logic and waste allowances, and the output then includes pricing.',
  },
  {
    question: 'How many components can I add?',
    answer:
      'Up to 7 custom components per session. Each one can have its own measurement type, pitch rule, waste allowance and pricing.',
  },
  {
    question: 'Is anything saved?',
    answer:
      'No. Nothing is saved and the session refreshes every time. If you want to keep a result, send it into the QuoteCore+ app from the output screen.',
  },
  {
    question: 'Is this the same as the takeoff demo?',
    answer:
      'No. The takeoff demo uses a sample roof plan and produces a sample quote. The free roof takeoff tool uses YOUR plan and produces YOUR measurements - upload your own plan, measure it with the drawing tools, and get a full measurement output.',
  },
  {
    question: 'Which measurement units does it support?',
    answer:
      'Metric (metres), Imperial (feet), and Roofing Squares. You choose your units at the start, and imperial users can enter pitch as an angle or a ratio.',
  },
  {
    question: 'Does it measure with AI?',
    answer:
      'No. Measuring in this free tool is manual - you draw the measurements on your plan. AI Scan Assist, which scans plans automatically, lives in the full QuoteCore+ app.',
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
    'The QuoteCore Plus free roof takeoff tool. Upload your own roof plan, measure lengths and areas with pitch calculations, and get a full measurement output. No signup required.',
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

export default function FreeRoofTakeoffPage() {
  return (
    <div className="bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <BlogHeader />

      {/* The tool itself sits directly under the header */}
      <FreeRoofTakeoff />

      {/* Intro / About block (below the tool) */}
      <section className="mx-auto max-w-3xl px-4 pt-14 pb-2 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Free · No sign-in · Nothing saved</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Free Roof Takeoff — Upload Your Own Plan
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          The QuoteCore Plus free roof takeoff lets you upload your own roof plan, measure lengths and areas digitally
          with pitch calculations, and get a full measurement output — no signup required.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Already measured everything? Turn it into a priced quote with{' '}
          <Link href="/takeoff-demo" className="text-[#BD4A1A] underline underline-offset-2">
            the 30-second takeoff demo
          </Link>
          .
        </p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How the free roof takeoff works</h2>
        <div className="mt-6 grid gap-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">1. Choose your measurement units</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Metric (metres), Imperial (feet) or Roofing Squares. Imperial and Roofing Squares users can enter roof
              pitch as an angle in degrees or as a ratio (e.g. 6:12).
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">2. Upload your plan</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Upload an image of your roof plan (PNG, JPG or WebP) and calibrate the scale from a known dimension.
              Calibrate once and every measurement you draw is to scale.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">3. Use default components or create up to 7 of your own</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              The default components give you pitch-calculated measurements and totals. If you also want pricing, build
              your own components with your own rates and waste allowances.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">4. Measure your roof</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Draw measurements directly on your plan — lengths, areas, ridges, hips, valleys. Pitch calculations are
              applied automatically, so plan measurements become true roof measurements.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">5. Finish and get your output</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              The full output includes pitch-calculated measurements, total areas, component quantities, and pricing if
              you added it to your own components. Test it on your own job — 30 seconds to start.
            </p>
          </div>
        </div>
      </section>

      {/* SEO body */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Test digital takeoff on a real job — before you buy software</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
          <p>
            Most roofers don&apos;t want to sit through a sales call to find out whether digital takeoff actually works
            for their plans. This tool is the opposite: open it, upload a plan from a real job, and measure it yourself.
            If it works for you, the full QuoteCore+ app adds AI scanning, saved component libraries, quotes, material
            orders and invoicing on top.
          </p>
          <p>
            The output is a measurement report, not a quote. You get pitch-calculated lengths and areas, totals per
            component, and pricing only where you&apos;ve entered your own rates. That keeps the numbers honest —
            nothing is estimated for you behind the scenes.
          </p>
          <p>
            Measuring is manual and precise: you draw each measurement on your calibrated plan. If you&apos;d rather
            see AI scan a plan automatically first, that&apos;s what AI Scan Assist does in the app — the{' '}
            <Link href="/takeoff-demo" className="text-[#BD4A1A] underline underline-offset-2">
              takeoff demo
            </Link>{' '}
            shows it on a sample plan.
          </p>
          <p>
            When your output looks right, you can send the result into QuoteCore+ and turn it into a quoted job — takeoff
            to quote without re-entering a single measurement. Related free tools that pair well with this one: the{' '}
            <Link href="/free-roof-pitch-calculator" className="text-[#BD4A1A] underline underline-offset-2">
              roof pitch calculator
            </Link>{' '}
            and the{' '}
            <Link href="/free-roofing-calculator" className="text-[#BD4A1A] underline underline-offset-2">
              roofing calculator
            </Link>
            .
          </p>
        </div>
        <TrialCTA className="mt-8" />
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

      <SiteFooter />
    </div>
  );
}
