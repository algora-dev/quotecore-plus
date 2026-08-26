import type { Metadata } from 'next';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
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

const bookCallClass =
  'inline-block rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]';
const talkUsClass =
  'inline-block rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:border-slate-400 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]';

const steps = [
  {
    num: '1',
    title: 'We learn how you currently work',
    body: [
      'We start with a short 15-minute call. Tell us how you currently price jobs, what you measure, what materials or services you normally use, whether you work from site measurements, plans, or both, what you currently use for estimating and quoting, and what you\u2019d actually like QuoteCore+ to make easier.',
      'This isn\u2019t a hard sell. If QuoteCore+ isn\u2019t a good fit for the way you work, we\u2019d rather tell you before you pay us to set anything up.',
    ],
  },
  {
    num: '2',
    title: 'You send us your pricing and setup',
    body: [
      'If it looks like a good fit, send us whatever you currently use to price work — supplier price lists, spreadsheets, labour rates, waste allowances, formulas, existing quotes, common products, services, your usual margins or pricing methods, and examples of the types of jobs you normally price.',
      'It doesn\u2019t have to be neat. We\u2019ll work through it with you.',
    ],
  },
  {
    num: '3',
    title: 'We build your QuoteCore+ system',
    body: [
      'We create your components and configure your account around the way you actually work.',
    ],
  },
  {
    num: '4',
    title: 'We show you how it works using your own setup',
    body: [
      'Once everything is configured, we\u2019ll walk you through your account using the pricing and components we built for you. Where possible, we can use a job you have already priced, a real upcoming job, one of your plans, or your own measurements.',
      'This can be done through a live screen-share session or a personalised screen recording you can watch whenever you like. The important part is that you see your own estimating system working inside QuoteCore+, rather than learning from generic examples.',
    ],
  },
  {
    num: '5',
    title: 'We stay around while you get used to it',
    body: [
      'You\u2019re not left on your own once setup is complete. Both packages include ongoing setup and product support for the first 6 months, as well as 6 months of QuoteCore+ Pro included at no extra cost.',
    ],
  },
];

const packages = [
  {
    name: 'Done-For-You Setup',
    price: '$499',
    tagline: 'Best for individual contractors and smaller businesses that want us to build the core of their estimating system.',
    items: [
      'Up to 20 custom components built for you',
      'Your material pricing configured',
      'Labour rates added',
      'Waste rules added where required',
      'QuoteCore+ account setup',
      'Setup based around your current workflow',
      'Personalised walkthrough / training',
      'Ongoing setup and product support for 6 months',
      '6 months QuoteCore+ Pro included',
    ],
  },
  {
    name: 'Complete Done-For-You Setup',
    price: '$999',
    tagline: 'Best for businesses with more products, services or a more detailed estimating system.',
    highlight: true,
    items: [
      'Everything in the standard setup, plus:',
      'Up to 60 custom components built for you',
      'Larger material and pricing setup',
      'More complex labour and waste configurations',
      'Help organising larger pricing lists or catalogues',
      'More detailed workflow configuration',
      'Additional setup assistance where required',
      'Personalised training using your own jobs and account',
      'Ongoing setup and product support for 6 months',
      '6 months QuoteCore+ Pro included',
    ],
  },
];

const doList = [
  'Build your agreed components',
  'Add the pricing information you provide',
  'Configure labour and waste rules',
  'Help recreate the way you currently price work',
  'Set up QuoteCore+ around your workflow',
  'Show you how to use your configured system',
  'Help you get comfortable using it',
  'Provide ongoing setup and product support during the included support period',
];

const dontList = [
  'Decide what your products should cost',
  'Decide what labour you should charge',
  'Guarantee the accuracy of pricing information supplied to us',
  'Replace your own checking of measurements, quantities or quotes',
  'Provide unlimited custom software development as part of the setup package',
  'Maintain constantly changing supplier catalogues indefinitely unless separately agreed',
];

export default function DoneForYouSetupPage() {
  return (
    <>
      <BlogHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main>
        {/* ── Hero ── */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 md:pb-20 md:pt-20">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            You don&rsquo;t have to figure it all out yourself.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
            If QuoteCore+ looks useful but the thought of rebuilding your
            pricing, setting up components, learning a new system and moving
            away from the way you already work sounds like a headache —{' '}
            <strong className="font-semibold text-slate-900">
              we can do most of it for you.
            </strong>
          </p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
            Tell us how you currently price your jobs, what materials and
            labour you use, and how your workflow works. We&rsquo;ll rebuild
            that inside QuoteCore+, set up your account, show you how to use it
            and support you while you get comfortable with the system.
          </p>
          <div className="mt-8">
            <Link href="/contact" className={bookCallClass}>
              Book a 15-minute fit call
            </Link>
          </div>
          <p className="mt-3 text-xs italic text-slate-400">
            First, let&rsquo;s make sure QuoteCore+ actually suits the way you
            work.
          </p>
        </section>

        {/* ── How it works ── */}
        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              How it works
            </h2>
            <ol className="mt-10 space-y-10">
              {steps.map((step) => (
                <li key={step.num} className="flex gap-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                    {step.num}
                  </span>
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-bold text-slate-900 md:text-xl">
                      {step.title}
                    </h3>
                    {step.body.map((para, i) => (
                      <p
                        key={i}
                        className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base"
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-12">
              <Link href="/contact" className={bookCallClass}>
                Book your 15-minute call
              </Link>
            </div>
          </div>
        </section>

        {/* ── Packages ── */}
        <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Choose your setup
          </h2>
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
                    one-time
                  </span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {pkg.tagline}
                </p>
                <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Includes
                </h4>
                <ul className="mt-3 space-y-2.5">
                  {pkg.items.map((item, i) => (
                    <li
                      key={i}
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
                  <Link href="/contact" className={bookCallClass}>
                    Book a 15-minute fit call
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Custom tier */}
          <div className="mt-6 rounded-xl border-dashed border-slate-200 bg-white px-6 py-10 text-center md:px-8">
            <h3 className="text-lg font-bold text-slate-900">
              Need more than 60 components?
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              No problem. Some businesses have much larger catalogues, several
              pricing systems or more complicated workflows. If your setup
              falls outside the two standard packages, we can put together a
              tailored package based on what you actually need.
            </p>
            <div className="mt-6">
              <Link href="/contact" className={talkUsClass}>
                Talk to us about your setup
              </Link>
            </div>
          </div>
        </section>

        {/* ── Does / doesn't include ── */}
        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              What this service does — and doesn&rsquo;t — include
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
              simply do the hard work of getting the system configured around
              the information you give us.
            </p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="mx-auto max-w-6xl px-6 py-16 text-center md:py-24">
          <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Still not sure whether QuoteCore+ suits the way you work?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
            That&rsquo;s exactly what the first call is for. You don&rsquo;t
            need to purchase anything before speaking with us. Spend 15 minutes
            showing us how you currently estimate and price your jobs. We&rsquo;ll
            tell you how QuoteCore+ could fit into that workflow, what we would
            set up for you and which package — if either — makes sense.
          </p>
          <p className="mt-4 text-sm font-semibold text-slate-900">
            No hard sell. No point setting it up if it won&rsquo;t help you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/contact" className={bookCallClass}>
              Book a 15-minute fit call
            </Link>
            <Link href="/features" className={talkUsClass}>
              Explore QuoteCore+
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
