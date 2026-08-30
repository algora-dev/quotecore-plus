import type { Metadata } from 'next';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import DfyPageViewTracker from '@/components/DfyPageViewTracker';
import DfyCtaButton from '@/components/DfyCtaButton';
import { siteUrl, buildBreadcrumbSchema } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';

export const metadata: Metadata = {
  title: 'Done-For-You Setup — We Build Your Estimating System | QuoteCore+',
  description:
    'We rebuild your current pricing and workflow inside QuoteCore+ for you — components, labour rates, waste rules, training and 6 months of support included.',
  alternates: {
    canonical: 'https://quote-core.com/done-for-you-setup',
    languages: hreflangLanguages('/done-for-you-setup'),
  },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: siteUrl },
  { name: 'Done-For-You Setup', url: `${siteUrl}/done-for-you-setup` },
]);

const faqs = [
  {
    q: 'What do I need to send you?',
    a: 'Your existing pricing, spreadsheets, supplier lists, labour rates, waste rules, past quotes and anything else relevant to how you currently estimate. It does not need to be tidy — we are rebuilding the agreed workflow, so your source information does not need to be presented perfectly.',
  },
  {
    q: 'Does my current setup need to be tidy?',
    a: 'No. Send us what you already use. We agree which parts to rebuild, then do the work of structuring it inside QuoteCore+.',
  },
  {
    q: 'Will you tell me what I should charge?',
    a: 'No. We configure the pricing and rules you supply — pricing decisions remain yours. We do not decide what your products should cost or what labour you should charge.',
  },
  {
    q: 'What happens after the setup is finished?',
    a: 'We walk you through your configured account — using one of your real jobs where practical — and provide the included support period (6 months) while you get comfortable using it on live work.',
  },
  {
    q: 'What if I need more than 60 components?',
    a: 'We can scope a tailored package after understanding the size and complexity of your setup. Book a fit call and we will talk it through.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const talkUsClass =
  'inline-block rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:border-slate-400 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]';

const stages = [
  {
    title: 'You send us',
    intro: 'It does not need to be tidy. Send us what you already use:',
    items: [
      'Your current estimating spreadsheet',
      'Supplier price lists',
      'Labour rates',
      'Waste rules',
      'Old quotes',
      'Products / services you regularly use',
      'Notes on how you currently price work',
    ],
  },
  {
    title: 'We build',
    intro: 'We rebuild the agreed parts of your existing estimating workflow inside QuoteCore+:',
    items: [
      'Your reusable Smart Components',
      'Material pricing',
      'Labour rules',
      'Waste rules',
      'Common products / services',
      'Agreed workflow structure',
      'QuoteCore+ account setup',
    ],
  },
  {
    title: 'You get',
    intro: 'A QuoteCore+ system built around the way you already work:',
    items: [
      'Ready-to-use estimating setup',
      'Reusable pricing logic',
      'Personalised walkthrough',
      'Training using your own workflow and jobs',
      'Ongoing setup support',
      '6 months QuoteCore+ Pro included',
    ],
  },
];

const qualification = [
  'Your spreadsheet works, but starting every new estimate still means copying and rebuilding things',
  'Your material prices, labour rates and waste rules live in different places',
  'Only one person really understands how your current estimating sheet works',
  'You know better software could help, but you do not want to spend evenings setting it up',
  'You have tried estimating software before and stopped because the setup was too much work',
  'You want to keep the way you price jobs, but make the process faster and easier to repeat',
];

const steps = [
  {
    num: '1',
    title: 'We learn how you work',
    body: 'A 15-minute fit call to understand how you measure, price and quote jobs — and whether QuoteCore+ is actually suitable.',
  },
  {
    num: '2',
    title: 'You send us what you use',
    body: 'Pricing, spreadsheets, supplier lists, labour rates, waste rules, past quotes and anything else relevant.',
  },
  {
    num: '3',
    title: 'We build it for you',
    body: 'We configure the agreed components, pricing and workflow inside QuoteCore+.',
  },
  {
    num: '4',
    title: 'We show you using your own setup',
    body: 'A personalised walkthrough using your own account and, where practical, one of your real jobs.',
  },
  {
    num: '5',
    title: 'You start using it',
    body: 'Use QuoteCore+ on live work, with ongoing setup and product support available for six months.',
  },
];

const packages = [
  {
    name: 'Done-For-You Estimating Setup',
    price: '$499',
    tagline: 'Best for smaller estimating setups or contractors with a focused range of products and services.',
    ctaEvent: 'dfy_package_499_cta_click',
    items: [
      'Up to 20 custom components built for you',
      'Your material pricing configured',
      'Labour and waste rules configured',
      'QuoteCore+ account setup',
      'Personalised training',
      'Ongoing setup and product support for 6 months',
      '6 months QuoteCore+ Pro included',
    ],
  },
  {
    name: 'Complete Done-For-You Setup',
    price: '$999',
    tagline: 'Best for larger or more detailed estimating systems.',
    highlight: true,
    ctaEvent: 'dfy_package_999_cta_click',
    items: [
      'Up to 60 custom components built for you',
      'Larger material and pricing setup',
      'More complex labour and waste configurations',
      'Help organising larger pricing lists or catalogues',
      'More detailed workflow configuration',
    ],
  },
];

const doList = [
  'Build the agreed components',
  'Add the pricing information you provide',
  'Configure agreed labour and waste rules',
  'Rebuild the agreed parts of your current workflow',
  'Show you how to use your configured setup',
  'Support you during the included support period',
];

const dontList = [
  'Decide what you should charge customers',
  'Guarantee the accuracy of information you supply',
  'Replace your responsibility to check final measurements and quotes',
  'Include unlimited custom software development',
  'Maintain changing supplier catalogues indefinitely unless separately agreed',
];

export default function DoneForYouSetupPage() {
  return (
    <>
      <BlogHeader />
      <DfyPageViewTracker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <main>
        {/* ── Hero ── */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 md:pb-20 md:pt-20">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            We build your estimating system inside QuoteCore+ for you
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
            Tell us how you currently measure, price and quote jobs.{' '}
            <strong className="font-semibold text-slate-900">
              We&rsquo;ll rebuild the agreed parts inside QuoteCore+
            </strong>{' '}
            — configure your pricing, labour, waste and reusable components,
            then show you how to use it on real jobs.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-500 md:text-base">
            You don&rsquo;t have to figure it all out yourself.
          </p>
          <div className="mt-8">
            <DfyCtaButton event="dfy_fit_call_click" label="See if QuoteCore+ fits your workflow" />
          </div>
          <p className="mt-3 text-xs italic text-slate-400">
            15-minute fit call · no hard sell
          </p>
        </section>

        {/* ── You send us → We build → You get ── */}
        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              What actually happens?
            </h2>
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {stages.map((stage, i) => (
                <div
                  key={stage.title}
                  className="relative rounded-xl border border-slate-200 bg-white p-8"
                >
                  <h3 className="text-lg font-bold text-slate-900">
                    {stage.title}
                  </h3>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {stage.intro}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {stage.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2.5 text-sm leading-relaxed text-slate-700"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {i < stages.length - 1 && (
                    <span
                      className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-slate-300 lg:block"
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-6 w-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="mx-auto mt-10 max-w-3xl text-center text-lg font-bold leading-snug tracking-tight text-slate-900 md:text-2xl">
              A QuoteCore+ system built around the way you already work —{' '}
              <span className="text-[#FF6B35]">ready to use on real jobs.</span>
            </p>
          </div>
        </section>

        {/* ── Qualification ── */}
        <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            This setup is probably worth considering if…
          </h2>
          <ul className="mt-10 max-w-3xl space-y-4">
            {qualification.map((item) => (
              <li
                key={item}
                className="flex gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm leading-relaxed text-slate-700 transition hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] md:text-base"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6B35]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-slate-500">
            If your current estimating system is already fast, reliable and easy
            to maintain, you may not need this. The fit call exists to work
            that out before you spend anything.
          </p>
        </section>

        {/* ── How it works ── */}
        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              How it works
            </h2>
            <ol className="mt-10 space-y-8">
              {steps.map((step) => (
                <li key={step.num} className="flex gap-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                    {step.num}
                  </span>
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-bold text-slate-900 md:text-xl">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-12 max-w-3xl text-lg font-bold leading-snug tracking-tight text-slate-900 md:text-2xl">
              Our goal is simple: get you confidently pricing and quoting real
              jobs in QuoteCore+ with{' '}
              <span className="text-[#FF6B35]">
                less repetitive admin than the way you were working before.
              </span>
            </p>
          </div>
        </section>

        {/* ── Packages ── */}
        <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Choose your setup
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            You tell us how you work. We turn it into a ready-to-use QuoteCore+
            system.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {packages.map((pkg) => (
              <div
                key={pkg.name}
                className={`rounded-xl border bg-white p-8 transition ${
                  pkg.highlight
                    ? 'border-orange-200 shadow-[0_0_12px_rgba(255,107,53,0.08)]'
                    : 'border-slate-200'
                }`}
              >
                <h3 className="text-lg font-bold text-slate-900">{pkg.name}</h3>
                <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                  {pkg.price}
                  <span className="ml-2 align-middle text-sm font-medium text-slate-500">
                    one-time · USD
                  </span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {pkg.tagline}
                </p>
                <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {pkg.highlight
                    ? 'Everything in the $499 setup, plus:'
                    : 'Includes'}
                </h4>
                <ul className="mt-3 space-y-2.5">
                  {pkg.items.map((item, i) => (
                    <li
                      key={item}
                      className={`flex gap-2.5 text-sm leading-relaxed text-slate-700 ${
                        i === 0 && pkg.highlight
                          ? 'font-semibold text-slate-900'
                          : ''
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <DfyCtaButton
                    event={pkg.ctaEvent}
                    label={
                      pkg.highlight
                        ? 'Book a fit call — Complete setup'
                        : 'Book a fit call — Estimating setup'
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Custom tier */}
          <div className="mt-6 rounded-xl border-dashed border-slate-200 bg-white px-6 py-10 text-center md:px-8">
            <h3 className="text-lg font-bold text-slate-900">
              Need more than 60 components or a very large catalogue?
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              Some businesses have much larger catalogues, several pricing
              systems or more complicated workflows. We can put together a
              tailored package based on what you actually need.
            </p>
            <div className="mt-6">
              <Link href="/contact" className={talkUsClass}>
                Talk to us about a tailored setup
              </Link>
            </div>
          </div>
        </section>

        {/* ── Does / doesn't include ── */}
        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              What we do — and don&rsquo;t — do
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-8">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                  We do
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {doList.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-sm leading-relaxed text-slate-700"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-8">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                  We don&rsquo;t
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {dontList.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-sm leading-relaxed text-slate-700"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-8 max-w-2xl text-sm leading-relaxed text-slate-600">
              You remain in control of your pricing and your final quotes. We
              do the work of getting the system configured around the
              information you give us.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Common questions
          </h2>
          <div className="mt-10 space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-slate-200 bg-white px-6 py-4 open:border-orange-200 open:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 marker:hidden md:text-base [&::-webkit-details-marker]:hidden">
                  {faq.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center md:py-24">
            <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              First, let&rsquo;s see if QuoteCore+ actually fits your workflow
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
              Tell us how you currently estimate and quote work. We&rsquo;ll
              look at what you&rsquo;re doing now, what would need to be
              rebuilt, and whether QuoteCore+ is genuinely a good fit. If it
              is, we&rsquo;ll explain which setup option makes sense. If it
              isn&rsquo;t, there&rsquo;s no point forcing it.
            </p>
            <p className="mt-4 text-sm font-semibold text-slate-900">
              No hard sell. The first step is simply checking the fit.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <DfyCtaButton event="dfy_fit_call_click_final" />
              <Link href="/features" className={talkUsClass}>
                Explore QuoteCore+
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
