import type { Metadata } from 'next';
import { DemoTakeoff } from './DemoTakeoff';
import BlogHeader from '@/components/BlogHeader';
import YouTubeLite from '@/components/YouTubeLite';
import { TrialCTA } from './TrialCTA';
import { buildFaqSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Free Roof Takeoff Demo — Try Digital Takeoff in 30 Seconds',
  description:
    'Interactive demo of the QuoteCore+ takeoff workstation. Scan a sample roof plan with AI or measure manually and produce a real customer quote. Free, no sign-in.',
  alternates: { canonical: '/takeoff-demo' },
  openGraph: {
    title: 'Free Roof Takeoff Demo — Try QuoteCore+ Digital Takeoff',
    description:
      'Scan a sample roof plan with AI or measure it manually, then see the customer quote your measurements produce. Free, no sign-in.',
    url: '/takeoff-demo',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    question: 'Is the takeoff demo really free with no sign-in?',
    answer:
      'Yes. The demo runs the full QuoteCore+ takeoff workstation with a sample roof plan. There is no sign-in, no payment details and nothing is saved — it is free to use as many times as you like.',
  },
  {
    question: 'What roof plan does the demo use?',
    answer:
      'The demo uses a sample roof plan with the pitch fixed at 25 degrees, and the AI scan result was captured from a real QuoteCore+ takeoff session. You can scan it with AI Scan Assist or measure it manually with the drawing tools.',
  },
  {
    question: 'Can I upload my own plans in the full app?',
    answer:
      'Yes. In the full QuoteCore+ app you upload your own roof plans (PDF or image), scan them with AI Scan Assist, measure manually, and price them with your own components. The demo uses a fixed sample plan so it needs no sign-in.',
  },
  {
    question: 'What does the free trial include?',
    answer:
      'The trial runs for 14 days with full features within the trial limits, including 20 AI Scan Assist points, and no credit card is required. After the trial the account moves to the free Lite plan unless you upgrade.',
  },
];

const faqSchema = buildFaqSchema(FAQS);

const webAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'QuoteCore+ Roof Takeoff Demo',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web browser (desktop)',
  url: 'https://quote-core.com/takeoff-demo',
  description:
    'Free interactive demo of the QuoteCore+ digital roof takeoff workstation. Scan a sample roof plan with AI or measure manually and produce a real customer quote. No sign-in required.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@id': 'https://quote-core.com/#organization' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://quote-core.com/' },
    { '@type': 'ListItem', position: 2, name: 'Free Roof Takeoff Demo', item: 'https://quote-core.com/takeoff-demo' },
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

      {/* The demo itself sits directly under the header */}
      <DemoTakeoff />

      {/* Intro / answer block (moved below the tool) */}
      <section className="mx-auto max-w-3xl px-4 pt-14 pb-2 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Interactive demo · Free · No sign-in</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Free Roof Takeoff Demo — Try QuoteCore+ Digital Takeoff
        </h1>
        <p className="mt-1 text-sm font-medium text-[#BD4A1A]">The QuoteCore Plus Takeoff Demo — free, no sign-in required.</p>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          An interactive demo of the QuoteCore+ takeoff workstation. Scan a sample roof plan with AI or measure it
          manually, and the demo produces a real customer quote from your measurements. Free, no sign-in — best on a
          desktop computer.
        </p>
      </section>

      {/* Mobile fallback: interactive demo needs a desktop; show product video instead */}
      <section className="mx-auto max-w-2xl px-4 py-10 md:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">See the product in action</h2>
          <p className="mt-2 text-sm text-slate-600">
            The interactive demo needs a desktop — here&apos;s the product in action instead: a full quote created from
            start to finish in under 3 minutes.
          </p>
          <div className="mt-4">
            <YouTubeLite videoId="pqIfx-rOcmo" title="Create a Quote from Start to Finish with QuoteCore+" showTitle rounded />
          </div>
            <TrialCTA label="Start a free 14-day trial — no card required" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How the takeoff demo works</h2>
        <div className="mt-6 grid gap-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">1. Scan the plan with AI</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Click &quot;Scan plan with AI&quot; and AI Scan Assist identifies the roof areas, ridges, hips, valleys
              and barges on the sample plan in seconds. The scan result in the demo was captured from a real QuoteCore+
              takeoff session, so you see exactly what the tool produces.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">2. Measure or verify on the plan</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Check the AI&apos;s measurements on the plan and adjust them, or skip the scan entirely and measure
              manually with the drawing tools. Every measurement you place feeds straight into the quote.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">3. See the customer quote your measurements produce</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Finish the takeoff and the demo generates the customer quote your measurements produced — line items,
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
            Most takeoff tools give you one way of working. In this demo — exactly as in the full app — both modes live
            in the same workstation. Use AI Scan Assist to find the roof areas and components automatically, then fine-tune
            anything it missed with the manual drawing tools. Or start from a blank canvas and measure the whole plan
            yourself, placing points and lines with the same precision tools. Either route ends in the same place: a
            priced, customer-ready quote.
          </p>
        </div>
      </section>

      {/* Trial CTA */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Take it into the full app</h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          This is the real workstation. Start a free 14-day trial — no card required.
        </p>
        <TrialCTA />
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
