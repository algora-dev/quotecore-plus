import type { Metadata } from 'next';
import { DemoTakeoff } from './DemoTakeoff';
import BlogHeader from '@/components/BlogHeader';
import YouTubeLite from '@/components/YouTubeLite';
import { TrialCTA } from './TrialCTA';
import { buildFaqSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Free Roof Takeoff Experience - Try Digital Takeoff on a Sample Plan',
  description:
    'Try the QuoteCore+ digital takeoff workstation on a sample roof plan. Scan with AI or measure manually and see the customer quote the measurements produce. Free, no sign-in.',
  alternates: { canonical: '/takeoff-demo' },
  openGraph: {
    title: 'Free Roof Takeoff Experience - Try QuoteCore+ Digital Takeoff',
    description:
      'Use a sample roof plan to try QuoteCore+ Digital Takeoff with AI or manual measurement, then see the customer quote the measurements produce. Free, no sign-in.',
    url: '/takeoff-demo',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    question: 'Is the sample roof takeoff really free with no sign-in?',
    answer:
      'Yes. The sample experience runs the QuoteCore+ takeoff workstation with a fixed roof plan. There is no sign-in, no payment details and nothing is saved. You can use the sample as many times as you like.',
  },
  {
    question: 'What roof plan does the sample experience use?',
    answer:
      'The experience uses a sample roof plan with the pitch fixed at 25 degrees, and the AI scan result was captured from a real QuoteCore+ takeoff session. You can scan it with Roof Scan Assist or measure it manually with the drawing tools.',
  },
  {
    question: 'Does the sample takeoff work on mobile?',
    answer:
      'Yes. It runs the same workstation the app uses, including the precision touch tools. Measure with your finger on a phone or tablet, or replay a scan captured from a real QuoteCore+ takeoff session.',
  },
  {
    question: 'Can I upload my own plans in the full app?',
    answer:
      'Yes. In your QuoteCore+ workspace you can upload your own roof plans (PDF or image), scan them with Roof Scan Assist, measure manually, and price them with your own components. This public sample uses a fixed plan so it needs no sign-in.',
  },
  {
    question: 'How do I get the full app?',
    answer:
      'Create a Free Workspace. It is a real QuoteCore+ account with no card and no expiry, so you can use your own jobs and open the optional Guided Walkthrough whenever you want help learning the connected workflow. Upgrade only if you later need more features, capacity or usage.',
  },
];

const faqSchema = buildFaqSchema(FAQS);

const webAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'QuoteCore+ Sample Roof Takeoff',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web browser (desktop, tablet, mobile)',
  url: 'https://quote-core.com/takeoff-demo',
  description:
    'Free sample experience of the QuoteCore+ digital roof takeoff workstation. Scan a fixed roof plan with AI or measure manually and produce a sample customer quote. No sign-in required.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@id': 'https://quote-core.com/#organization' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://quote-core.com/' },
    { '@type': 'ListItem', position: 2, name: 'Free Roof Takeoff', item: 'https://quote-core.com/takeoff-demo' },
  ],
};

export default function TakeoffDemoPage() {
  return (
    <div className="bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Standard site header */}
      <BlogHeader />

      {/* Focused sample takeoff experience */}
      <DemoTakeoff />

      {/* Intro / answer block (moved below the tool) */}
      <section className="mx-auto max-w-3xl px-4 pt-14 pb-2 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Sample roof takeoff · Free · No sign-in</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Try QuoteCore+ Digital Takeoff on a sample roof
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Scan the fixed roof plan with AI or measure it manually, then see the customer quote your measurements produce.
          Nothing is saved and no account is required for this sample. When you want to use your own plans and pricing,
          create a Free Workspace.
        </p>
      </section>

      {/* Product video: extra context for visitors */}
      <section className="mx-auto max-w-2xl px-4 py-10 md:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">See the product in action</h2>
          <p className="mt-2 text-sm text-slate-600">
            Prefer to watch first? Here&apos;s the product in action: a full quote created from start to finish in
            under 3 minutes.
          </p>
          <div className="mt-4">
            <YouTubeLite videoId="pqIfx-rOcmo" title="Create a Quote from Start to Finish with QuoteCore+" showTitle rounded />
          </div>
            <div className="mt-6"><TrialCTA label="Create my free workspace" /></div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How the sample takeoff works</h2>
        <div className="mt-6 grid gap-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">1. Scan the plan with AI</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Click &quot;Scan plan with AI&quot; and Roof Scan Assist identifies the roof areas, ridges, hips, valleys
              and barges on the sample plan in seconds. The scan result in this sample was captured from a real QuoteCore+
              takeoff session, so you see exactly what the tool produces.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">2. Measure or verify on the plan</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Review the AI measurements on the plan and adjust them if needed, or skip the scan entirely and measure manually with the drawing tools. Every measurement you place feeds straight into the quote.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">3. See the customer quote your measurements produce</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Finish the takeoff and the sample generates the customer quote your measurements produced - line items,
              totals and terms, in the same format the full app sends to your customers.
            </p>
          </div>
        </div>
      </section>

      {/* Manual or AI */}
      <section className="bg-white border-y border-slate-200">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Measure manually or scan with AI</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Most takeoff tools give you one way of working. In this sample, just as in the full app, both modes live
            in the same workstation. On a clear, correctly calibrated plan, Roof Scan Assist can complete suitable roof geometry automatically. Review the result and use the manual drawing tools only where adjustments are needed. Or start from a blank canvas and measure the whole plan
            yourself, placing points and lines with the same precision tools. Either route ends in the same place: a
            priced, customer-ready quote.
          </p>
        </div>
      </section>

      {/* Get started CTA */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Take it into your own workspace</h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Create a real Free Workspace, upload your own plans, use your own jobs and pricing, and keep using it for as long as the free allowances are enough. The optional Guided Walkthrough is there whenever you want help learning the connected workflow.
        </p>
        <TrialCTA label="Create my free workspace" />
      </section>

      {/* FAQ */}
      <section className="bg-white border-t border-slate-200">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Frequently asked questions</h2>
          <div className="mt-6 grid gap-6">
            {FAQS.map(faq => (
              <div key={faq.question}>
                <h3 className="text-base font-semibold text-slate-900">{faq.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
