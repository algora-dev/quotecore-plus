import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { hreflangLanguages } from "@/lib/seo/hreflang";
import {
  buildSoftwareApplicationSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
} from "@/lib/schema";

export const metadata: Metadata = {
  title: "Construction Takeoff Software — Measure PDF Plans Digitally | QuoteCore+",
  description:
    "Digital construction takeoff software for PDF plans and images. Measure roof, siding/cladding and flooring areas, lengths and quantities, then feed them into materials, labour and pricing. Try the takeoff tools free — no signup.",
  openGraph: {
    title: "Construction Takeoff Software — Measure PDF Plans Digitally | QuoteCore+",
    description:
      "Measure roof, siding/cladding and flooring areas, lengths and quantities from PDF plans and images, then feed the measurements into materials, labour and pricing.",
    url: "/construction-takeoff-software",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/construction-takeoff-software",
    languages: hreflangLanguages("/construction-takeoff-software"),
  },
};

const faqs = [
  {
    question: "What is construction takeoff software?",
    answer:
      "Construction takeoff software lets you measure areas, lengths and quantities directly from digital plans - PDFs, drawings or images - instead of printing them and working with a scale ruler. You calibrate the drawing scale once, then trace measurements on screen and the software totals every quantity.",
  },
  {
    question: "Can I measure PDF plans?",
    answer:
      "Yes. QuoteCore+'s takeoff tools accept PDF plans (up to 50 MB - pick the page you need) as well as PNG, JPG and WebP images, including photos or screenshots of blueprints. Calibrate the scale from any known dimension and every measurement is to scale.",
  },
  {
    question: "Can I use imperial and metric?",
    answer:
      "Both. Roof takeoff supports metric (square metres, metres), imperial (square feet, feet) and roofing squares, with pitch entered as degrees or a ratio like 6:12. Cladding and flooring takeoff support metric and imperial.",
  },
  {
    question: "Can I use measurements from another service?",
    answer:
      "Yes. You do not need to perform the takeoff inside QuoteCore+. If you have measurements from a site measure, a third-party report, an aerial or satellite measurement service, another takeoff app or a spreadsheet, enter them directly into the Measurement-to-Quote tool and apply your own pricing rules.",
  },
  {
    question: "Does takeoff include estimating?",
    answer:
      "Takeoff produces the measurements. Estimating applies materials, labour, waste and pricing to those measurements, and quoting turns the priced result into a customer document. QuoteCore+ connects all three stages, and each stage can also be used on its own.",
  },
  {
    question: "Can I try it without signing up?",
    answer:
      "Yes. The core takeoff tools - roof, siding/cladding, flooring and measurement-to-quote - can be used without creating an account. An account is only needed to save takeoffs and continue into the full QuoteCore+ workflow.",
  },
  {
    question: "Is this only for roofing?",
    answer:
      "No. Roofing is the deepest workflow, but the same takeoff-and-price approach covers siding and cladding, flooring, and any trade that measures from plans - fencing, decking, concrete, landscaping and more.",
  },
];

const faqSchema = buildFaqSchema(faqs);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: "https://quote-core.com/" },
  { name: "Construction Takeoff Software", url: "https://quote-core.com/construction-takeoff-software" },
]);

const softwareSchema = {
  "@context": "https://schema.org",
  ...buildSoftwareApplicationSchema(),
};

const tradeCards = [
  {
    title: "Roofing",
    body: "Measure roof areas from plan or satellite image, with ridges, hips, valleys, barges and eaves as lineal runs. Pitch factors convert plan measurements to true sloped areas. Units in square metres, square feet or roofing squares.",
    links: [
      { href: "/roofing-takeoff-software", label: "Roofing takeoff software" },
      { href: "/free-roof-takeoff", label: "Free roof takeoff tool" },
    ],
  },
  {
    title: "Siding / cladding / walls",
    body: "Measure elevation plans: wall and cladding areas, window and door openings deducted, trims and corner runs as linear quantities, battens and cavity systems by wall area. In the U.S. and Canada this is usually called a siding takeoff.",
    links: [
      { href: "/free-cladding-takeoff", label: "Free siding & cladding takeoff tool" },
    ],
  },
  {
    title: "Flooring",
    body: "Measure floor plans room by room: usable floor areas by material, baseboard/skirting and transition strips as linear runs, counts for anything priced per unit. Timber, LVP, laminate, carpet and tile all work the same way.",
    links: [
      { href: "/free-flooring-takeoff", label: "Free flooring takeoff tool" },
    ],
  },
];

const workflowFlow = ["Plan / measurements", "Takeoff", "Pricing", "Estimate / quote", "Purchase order", "Invoice"];

const link = "text-[#BD4A1A] hover:underline";

export default function ConstructionTakeoffSoftwarePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Construction Takeoff Software" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-16 pt-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.10),transparent_34%)]" />
          <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
              Construction Takeoff Software
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Digital construction takeoff software for plans, areas &amp; lengths.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 sm:text-xl">
              Upload construction plans and measure areas, lengths and quantities digitally. Use the same workflow for
              roofs, siding/cladding, floors and other measured work, then turn the measurements into materials,
              labour, pricing and professional estimates or quotes.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="/free-construction-takeoff-tools"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#FF6B35] px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-[#E55A28]"
              >
                Try the free takeoff tools
              </a>
              <a
                href="/free-trial"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-8 py-3 text-base font-semibold text-zinc-900 transition-colors hover:border-[#FF6B35]/40"
              >
                Start free trial
              </a>
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              Free tools need no signup. Trial includes every feature for 14 days, no card.
            </p>
          </div>
        </section>

        {/* What is construction takeoff software */}
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">What is construction takeoff software?</h2>
          <p className="mt-6 text-lg leading-8 text-zinc-700">
            Construction takeoff software (also called digital takeoff, plan takeoff or quantity takeoff software)
            lets contractors and estimators measure drawings digitally instead of printing plans and working with a
            scale ruler and calculator. Upload the plan, calibrate the scale from a known dimension, then trace areas
            and lengths on screen - the software totals every quantity.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Three stages matter, and keeping them straight helps you pick the right tool:
          </p>
          <ul className="mt-5 space-y-3 text-lg leading-8 text-zinc-600">
            <li><strong className="text-zinc-950">Takeoff</strong> = extracting dimensions and quantities from plans (roof areas, wall areas, linear runs, counts).</li>
            <li><strong className="text-zinc-950">Estimating</strong> = applying materials, labour, waste and pricing to those measurements.</li>
            <li><strong className="text-zinc-950">Quoting / proposal</strong> = turning the priced result into the customer-facing estimate, quote, bid or proposal.</li>
          </ul>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            QuoteCore+ covers the whole chain - but each stage also works on its own, and the core takeoff tools are
            free without an account.
          </p>
        </section>

        {/* Trade sections */}
        <section className="bg-zinc-50 py-16">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">Measure different types of construction work</h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              One digital measurement workflow, three measured surfaces.
            </p>
            <div className="mt-10 grid gap-6">
              {tradeCards.map((t) => (
                <div key={t.title} className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6">
                  <h3 className="text-xl font-semibold">{t.title}</h3>
                  <p className="mt-3 text-zinc-600">{t.body}</p>
                  <p className="mt-3 text-sm">
                    {t.links.map((l, i) => (
                      <span key={l.href}>
                        {i > 0 && " · "}
                        <Link href={l.href} className={link}>{l.label}</Link>
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* From takeoff to estimate */}
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">From takeoff to estimate</h2>
          <p className="mt-6 text-lg leading-8 text-zinc-600">
            Measurements alone don&rsquo;t price a job. In QuoteCore+, reusable Smart Components&trade; carry the logic
            that converts quantities into cost: material rates, labour per unit, waste percentages, pack sizes, pitch
            factors and pricing rules. Build the rules once, and every takeoff - or any measurement set you enter by
            hand - flows through the same pricing automatically.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            <Link href="/measurement-to-quote-tool" className={link}>See how measurements become a priced estimate →</Link>
          </p>
        </section>

        {/* Already have measurements */}
        <section className="mx-auto max-w-4xl px-6 pb-16 lg:px-8">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-6 py-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">Already have measurements?</h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              You don&rsquo;t need to perform the takeoff inside QuoteCore+. Measurements can come from anywhere: a
              site measure, a third-party report, an aerial or satellite measurement service, another takeoff app, a
              spreadsheet, or a schedule on the architect&rsquo;s plan. Enter them directly and apply your pricing.
            </p>
            <p className="mt-4">
              <Link href="/measurement-to-quote-tool" className="font-semibold text-[#BD4A1A] hover:underline">
                Start from your measurements →
              </Link>
            </p>
          </div>
        </section>

        {/* Try the workflow free */}
        <section className="bg-zinc-50 py-16">
          <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">Try the workflow free</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
              Use your own plan, calibrate the scale and measure real areas and lengths - no signup, no credit card,
              real output you can use. The full app adds saving, reusable component libraries, AI where applicable,
              and the connected job and document workflow.
            </p>
            <a
              href="/free-construction-takeoff-tools"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#FF6B35] px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-[#E55A28]"
            >
              See all free construction takeoff tools
            </a>
          </div>
        </section>

        {/* Full app workflow */}
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">The full app workflow</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {workflowFlow.map((label, i) => (
              <span key={label} className="inline-flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium ${i === 0 || i === 1 ? "bg-[#FF6B35] text-white" : "bg-zinc-100 text-zinc-600"}`}>
                  {label}
                </span>
                {i < workflowFlow.length - 1 && <span className="text-zinc-300">→</span>}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-zinc-600">
            The same job data carries all the way through - no re-entry between tools. See{" "}
            <Link href="/construction-quoting-software" className={link}>contractor estimating &amp; quoting software</Link>{" "}
            for the full picture.
          </p>
        </section>

        {/* Done-for-you setup */}
        <section className="mx-auto max-w-4xl px-6 pb-16 lg:px-8">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">Done-for-you setup</h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              Most estimating software hands you a blank page. QuoteCore+ doesn&rsquo;t have to. If you already price
              work with spreadsheets, price lists, quote templates or reusable component rules, we can help rebuild
              that setup inside QuoteCore+ with you - configuration, onboarding and training included.
            </p>
            <p className="mt-4">
              <Link href="/done-for-you-setup" className="font-semibold text-[#BD4A1A] hover:underline">
                See how Done-For-You setup works →
              </Link>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-6 pb-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">Construction takeoff software FAQ</h2>
          <div className="mt-8 space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="text-lg font-semibold">{faq.question}</h3>
                <p className="mt-2 leading-7 text-zinc-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="border-t border-zinc-100 bg-zinc-50 py-14">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-2xl font-semibold">Keep exploring</h2>
            <ul className="mt-4 space-y-2 text-zinc-600">
              <li><Link href="/free-construction-takeoff-tools" className={link}>Free construction takeoff tools</Link> — measure your own plans, no signup</li>
              <li><Link href="/roofing-takeoff-software" className={link}>Roofing takeoff software</Link> — roof measurement from PDF plans</li>
              <li><Link href="/construction-quoting-software" className={link}>Contractor estimating &amp; quoting software</Link> — the connected workflow</li>
              <li><Link href="/blog/how-to-measure-pdf-plans" className={link}>How to measure PDF plans</Link> — the step-by-step guide</li>
              <li><Link href="/free-tools" className={link}>All free tools</Link> — calculators, generators and takeoff tools</li>
            </ul>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
