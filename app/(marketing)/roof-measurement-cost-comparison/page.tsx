import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "What Does a Roof Measurement or Quote Actually Cost? QuoteCore+ vs Per-Report Services",
  description:
    "Roof measurement reports cost $13-$105 each. QuoteCore+ works out to well under $1 per quote. A sourced, dated cost comparison of QuoteCore+, RoofSnap, EagleView and PlanSwift.",
  alternates: {
    canonical: "https://quote-core.com/roof-measurement-cost-comparison",
  },
  openGraph: {
    title: "What Does a Roof Measurement or Quote Actually Cost?",
    description:
      "Roof measurement reports cost $13-$105 each. QuoteCore+ works out to well under $1 per quote. Sourced, dated comparison.",
    url: "https://quote-core.com/roof-measurement-cost-comparison",
    type: "article",
  },
};

const rows = [
  {
    service: "QuoteCore+",
    model: "Subscription (free tier available)",
    cost: "Cents per AI scan, worst case ~$0.50 per measurement; Pro at $39/mo with 50+ quotes/mo works out to well under $1 per quote",
    detail:
      "Measure your own plans (manual takeoff is unlimited and free of per-measurement fees) or use AI Scan Assist at cents per scan. Full trial is genuinely free — no card required.",
    highlight: true,
  },
  {
    service: "RoofSnap",
    model: "Per report or subscription",
    cost: "From $13 per report; $105/mo per user monthly ($52-78/mo annual)",
    detail: "Order a flown measurement report, or subscribe for DIY measurement tools. Prices checked August 2026.",
  },
  {
    service: "EagleView",
    model: "Per report",
    cost: "$32.75-$89.50 per construction report at list price (typical range $13.75-$105 depending on size and tier)",
    detail: "Professionally measured aerial reports with volume tier discounts. Prices checked August 2026.",
  },
  {
    service: "PlanSwift",
    model: "Annual licence per seat",
    cost: "US$2,000 per year per seat (Professional)",
    detail: "General construction takeoff software; trade plugins and starter packs sold separately. Prices checked August 2026.",
  },
];

export default function RoofMeasurementCostComparison() {
  return (
    <>
      <BlogHeader />
      <main className="min-h-screen bg-white text-zinc-950">
        <article className="mx-auto w-full max-w-4xl px-6 py-14 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
            Cost comparison
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
            What does a roof measurement or quote actually cost?
          </h1>
          <p className="mt-3 text-base text-zinc-500">
            QuoteCore+ vs per-report measurement services — prices checked August 2026
          </p>

          <div className="prose prose-zinc mt-10 max-w-none prose-a:text-[#BD4A1A]">
            <p>
              &ldquo;How much does a roof measurement report cost?&rdquo; is a fair question with a
              surprisingly wide answer. Depending on the service and roof size, an outsourced
              measurement report costs anywhere from $13 to $105. Software that lets you measure
              yourself runs from a monthly subscription to a four-figure annual licence.
            </p>
            <p>
              Here&rsquo;s the honest breakdown, with every price sourced from official pricing
              pages and dated. We&rsquo;re in this comparison too — our costs are stated with plan
              context so you can check the maths yourself.
            </p>
          </div>

          <h2 className="mt-14 text-2xl font-semibold">The comparison at a glance</h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-5 py-4 font-semibold text-zinc-900">Service</th>
                  <th className="px-5 py-4 font-semibold text-zinc-900">Pricing model</th>
                  <th className="px-5 py-4 font-semibold text-zinc-900">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.service} className={r.highlight ? "bg-orange-50/40" : ""}>
                    <td className="px-5 py-4 font-semibold text-zinc-900">{r.service}</td>
                    <td className="px-5 py-4 text-zinc-600">{r.model}</td>
                    <td className="px-5 py-4 text-zinc-700">
                      {r.cost}
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">{r.detail}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            All prices from official pricing pages, checked August 2026. Regional pricing may
            differ.
          </p>

          <h2 className="mt-14 text-2xl font-semibold">How QuoteCore+ works out to under $1 per quote</h2>
          <div className="prose prose-zinc mt-4 max-w-none prose-a:text-[#BD4A1A]">
            <p>
              QuoteCore+ is subscription software, not a per-report service. Manual digital takeoff
              is unlimited — no per-measurement fee. AI Scan Assist (which detects roof areas,
              ridges, hips, valleys, barges and spouting for you to verify) costs cents per scan,
              with a worst case around $0.50.
            </p>
            <p>
              On the Pro plan ($39/mo), a roofer sending 50+ quotes a month works out to well under
              $1 per quote — including measurement, pricing, the quote document itself, sending,
              tracking, material orders and invoicing. The 14-day trial is genuinely free: every
              feature, no card required.
            </p>
            <p>
              We&rsquo;ve demonstrated a complete complex roofing quote created in under 3 minutes
              for less than $1 —{" "}
              <Link href="/" className="font-medium text-[#BD4A1A] underline underline-offset-2">
                see the video on our homepage
              </Link>
              .
            </p>
          </div>

          <h2 className="mt-14 text-2xl font-semibold">When a per-report service makes sense</h2>
          <div className="prose prose-zinc mt-4 max-w-none prose-a:text-[#BD4A1A]">
            <p>
              Outsourced reports make sense when you have no plans at all, need third-party
              verification, or quote rarely enough that a subscription never pays off. If you
              measure a handful of roofs a year, a $13-$105 report is a reasonable purchase.
            </p>
            <p>
              If you quote weekly or more — and especially if you then rebuild the measured roof
              into materials, labour and a priced quote — the per-report maths gets expensive fast,
              and the measurement doesn&rsquo;t carry through to the quote. That&rsquo;s the gap
              QuoteCore+ is built to close.
            </p>
          </div>

          <h2 className="mt-14 text-2xl font-semibold">Deeper comparisons</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              { href: "/roofsnap-alternative", label: "QuoteCore+ vs RoofSnap" },
              { href: "/eagleview-alternative", label: "QuoteCore+ vs EagleView" },
              { href: "/planswift-alternative", label: "QuoteCore+ vs PlanSwift" },
              { href: "/pricing", label: "QuoteCore+ pricing" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm font-medium text-zinc-800 transition-colors hover:border-[#FF6B35]/40 hover:bg-orange-50/40"
              >
                {l.label} →
              </Link>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-zinc-200 bg-zinc-50 px-8 py-10 text-center">
            <h2 className="text-xl font-semibold">Try the measure-to-quote workflow yourself</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600">
              Full access for 14 days. No card required. Plans from free to $59/month.
            </p>
            <Link
              href="/free-trial"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
            >
              Start free trial
            </Link>
          </div>
        </article>
        <SiteFooter />
      </main>
    </>
  );
}
