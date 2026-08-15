import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import {
  buildSoftwareApplicationSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  siteUrl,
} from "@/lib/schema";

export const metadata: Metadata = {
  title: "Roofing Takeoff Software for PDF Plans | QuoteCore+",
  description:
    "Measure roof areas, lengths and pitch from PDF plans with AI Scan Assist and digital takeoff. Get automatic material quantities and pricing. Free roof takeoff builder — no signup required.",
  openGraph: {
    title: "Roofing Takeoff Software for PDF Plans | QuoteCore+",
    description:
      "Measure roof areas, lengths and pitch from PDF plans with AI Scan Assist and digital takeoff. Get automatic material quantities and pricing. Free roof takeoff builder — no signup required.",
    url: "/roofing-takeoff-software",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/roofing-takeoff-software",
  },
};

const faqs = [
  {
    question: "Can QuoteCore+ do roofing takeoffs from PDF plans?",
    answer:
      "Yes. Upload a PDF plan, satellite image or drawing and use the digital takeoff tools to measure roof areas, ridge, hip, valley, eave and barge lengths, and pitch. Measurements are calculated automatically and feed directly into Smart Components for pricing.",
  },
  {
    question: "How does AI Scan Assist work for roof takeoffs?",
    answer:
      "AI Scan Assist analyses an uploaded plan and automatically identifies roof areas, ridges, hips, valleys, barges and spouting. You review and adjust the detected measurements before they become part of the estimate. It significantly speeds up the takeoff process, especially for complex roofs with multiple sections.",
  },
  {
    question: "Can I measure ridge, hip, and valley lengths, not just roof areas?",
    answer:
      "Yes. The digital takeoff tools measure both roof surface areas and linear lengths — ridges, hips, valleys, barges, eaves, flashings and spouting. All measurements can be named, grouped by roof section, and assigned different materials and pitch values.",
  },
  {
    question: "Does QuoteCore+ calculate material quantities from takeoff measurements?",
    answer:
      "Yes. Smart Components apply your stored materials, labour, waste allowances and pricing rules to takeoff measurements automatically. When you measure a roof area, the corresponding material quantities, screws, flashings and labour are calculated without manual entry.",
  },
  {
    question: "What plan formats does QuoteCore+ support for takeoff?",
    answer:
      "QuoteCore+ supports uploaded images and PDF plans. AI Scan Assist works on the uploaded plan image to identify roof geometry. You can also use the free roof takeoff builder without uploading a plan if you already have measurements.",
  },
  {
    question: "Can I export takeoff measurements without creating a quote?",
    answer:
      "Yes. Measurements can be reviewed and adjusted before you decide to create a quote. The takeoff feeds into the estimate and quote only when you choose to proceed. The free roof takeoff builder also lets you generate measurements without any commitment.",
  },
];

const faqSchema = buildFaqSchema(faqs);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "Roofing Takeoff Software", url: `${siteUrl}/roofing-takeoff-software` },
]);

const softwareSchema = {
  "@context": "https://schema.org",
  ...buildSoftwareApplicationSchema(),
};

const takeoffSteps = [
  {
    number: "01",
    title: "Upload PDF plans or use AI Scan Assist",
    body: "Upload a roof plan, satellite image or drawing. Use AI Scan Assist to auto-detect roof areas, ridges, hips, valleys, barges and spouting, or measure manually with digital takeoff tools.",
  },
  {
    number: "02",
    title: "Measure roof areas, lengths and pitch digitally",
    body: "Name each roof area, assign pitch and material type. Digital takeoff handles angles, pitches and complex roof geometry. Measure ridges, hips, valleys, eaves, barges, flashings and spouting lengths.",
  },
  {
    number: "03",
    title: "Smart Components apply material quantities, waste and labour",
    body: "Measurements feed directly into Smart Components, which apply your stored materials, waste allowances, labour rates and pricing rules automatically. No spreadsheet formulas, no manual re-entry.",
  },
  {
    number: "04",
    title: "Review, adjust and send as a quote",
    body: "Check the takeoff and pricing, adjust any measurement or quantity, then send it to the customer as a professional quote. The same data carries through to material orders and invoices.",
  },
];

const whatItMeasures = [
  "Roof surface areas (by pitch)",
  "Ridge, hip, valley, eave and barge lengths",
  "Flashing and trim lengths",
  "Spouting and downpipe quantities",
  "Pitch and slope calculations",
  "Material quantities with waste allowances applied",
];

const limitations = [
  {
    title: "No 3D modelling",
    body: "QuoteCore+ measures roof geometry in 2D from plans and images. It does not generate 3D roof models or visualisations.",
  },
  {
    title: "No cutting lists",
    body: "QuoteCore+ calculates material quantities and pricing, not individual cutting schedules for each piece of material on site.",
  },
  {
    title: "No accounting integration",
    body: "Takeoffs, estimates and invoices are created within QuoteCore+, but it does not sync with Xero, QuickBooks or other accounting software.",
  },
];

export default function RoofingTakeoffSoftwarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Roofing Takeoff Software" }]} />

        {/* Cross-trade notice */}
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-3 text-center text-sm text-zinc-600">
          QuoteCore+ also works across cladding, flooring, fencing, landscaping, and other construction trades.{" "}
          <a href="/construction-quoting-software" className="font-medium text-[#FF6B35] hover:underline">
            See the full construction quoting software page
          </a>
        </div>

        {/* Hero */}
        <section className="relative overflow-hidden pb-16 pt-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.10),transparent_34%)]" />
          <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Roofing takeoff software that measures plans digitally and calculates materials automatically.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 sm:text-xl">
              Upload plans and measure roof areas, lengths and pitch digitally. AI Scan Assist detects roof geometry automatically. Smart Components&#8482; turn measurements into material quantities and priced estimates. Plans from free to $59/month.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="/free-trial"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-black px-8 py-3 text-base font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
              >
                Start your free 14-day trial
              </a>
            </div>

            <p className="mt-3 text-sm text-zinc-500">No credit card required.</p>
          </div>
        </section>

        {/* What is roofing takeoff software? */}
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            What is roofing takeoff software?
          </h2>

          <p className="mt-6 text-lg leading-8 text-zinc-700">
            Roofing takeoff software helps contractors measure roof areas, lengths and pitch from plans or images, and calculate material quantities from those measurements.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Manual takeoff means printing plans, using a scaling ruler to measure dimensions, counting features by hand, and entering everything into a spreadsheet. It works, but it is slow, error-prone, and has to be repeated from scratch on every job.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            QuoteCore+ replaces that with digital takeoff tools and AI Scan Assist. Upload a plan, measure digitally or let AI detect roof geometry, and Smart Components&#8482; automatically apply materials, labour, waste and pricing. The takeoff becomes an estimate, and the estimate becomes a quote — all in one connected workflow.
          </p>
        </section>

        {/* Key takeoff features */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Key takeoff features
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              The tools that make takeoff faster and more accurate in QuoteCore+.
            </p>

            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <a
                href="/features/digital-roof-takeoff"
                className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6 transition-all hover:border-orange-200 hover:bg-orange-50/40"
              >
                <h3 className="text-xl font-semibold">Digital roof takeoff</h3>
                <p className="mt-3 text-zinc-600">
                  Measure roof areas, lengths and pitch from uploaded plans. Handles angles, complex geometry and multiple roof sections.
                </p>
              </a>
              <a
                href="/features/ai-scan-assist"
                className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6 transition-all hover:border-orange-200 hover:bg-orange-50/40"
              >
                <h3 className="text-xl font-semibold">AI Scan Assist</h3>
                <p className="mt-3 text-zinc-600">
                  Automatically identifies roof areas, ridges, hips, valleys, barges and spouting from an uploaded plan.
                </p>
              </a>
              <a
                href="/features/smart-components"
                className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6 transition-all hover:border-orange-200 hover:bg-orange-50/40"
              >
                <h3 className="text-xl font-semibold">Smart Components&#8482;</h3>
                <p className="mt-3 text-zinc-600">
                  Automatically apply materials, labour, waste and pricing to takeoff measurements. No manual quantity calculation.
                </p>
              </a>
              <a
                href="/features/material-ordering"
                className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6 transition-all hover:border-orange-200 hover:bg-orange-50/40"
              >
                <h3 className="text-xl font-semibold">Material ordering</h3>
                <p className="mt-3 text-zinc-600">
                  Turn takeoff quantities into a material order with supplier details carried over. No re-keying.
                </p>
              </a>
            </div>
          </div>
        </section>

        {/* How takeoff works */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            How takeoff works in QuoteCore+
          </h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            From plan upload to material quantities in four steps.
          </p>

          <div className="mt-12 flex flex-col gap-5">
            {takeoffSteps.map((s) => (
              <div
                key={s.number}
                className="rounded-[2rem] border border-zinc-200 bg-white px-7 py-6 shadow-sm"
              >
                <div className="flex items-start gap-6">
                  <span className="w-12 shrink-0 text-2xl font-semibold text-zinc-950">
                    {s.number}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">{s.title}</h3>
                    <p className="mt-3 text-zinc-600">{s.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What QuoteCore+ measures in takeoff */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              What QuoteCore+ measures in takeoff
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              Roofing-specific measurement types handled by the digital takeoff workflow.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {whatItMeasures.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-[1.5rem] border border-zinc-200 bg-white px-5 py-4 text-zinc-700"
                >
                  <span className="mt-1 shrink-0 font-bold text-[#FF6B35]">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Takeoff vs estimating */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Takeoff vs estimating — what&apos;s the difference?
          </h2>

          <p className="mt-6 text-lg leading-8 text-zinc-700">
            Takeoff is the measurement step — measuring roof areas, lengths and pitch from a plan. Estimating adds pricing, labour, waste and material quantities to those measurements.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Many contractors do takeoff in one tool, then re-enter the measurements into a spreadsheet to estimate. QuoteCore+ does both in one workflow: takeoff measurements feed directly into Smart Components&#8482;, which apply materials, labour, waste and pricing automatically.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            See the{" "}
            <a href="/roofing-estimating-software" className="font-medium text-[#FF6B35] hover:underline">
              roofing estimating software
            </a>{" "}
            page for more on the estimating side.
          </p>
        </section>

        {/* Honest limitations */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            What QuoteCore+ does not do
          </h2>
          <div className="mt-8 space-y-4">
            {limitations.map((l) => (
              <div
                key={l.title}
                className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5"
              >
                <p className="font-semibold text-zinc-950">{l.title}</p>
                <p className="mt-2 text-sm leading-7 text-zinc-600">{l.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Common questions
            </h2>

            <div className="mt-10 space-y-4">
              {faqs.map((f) => (
                <div
                  key={f.question}
                  className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5"
                >
                  <p className="font-semibold text-zinc-950">{f.question}</p>
                  <p className="mt-3 text-sm leading-7 text-zinc-600">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Related */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">Related</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/roofing-estimating-software"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Roofing estimating software</p>
              <p className="mt-1 text-sm text-zinc-600">
                Turn takeoff measurements into priced estimates with Smart Components.
              </p>
            </a>
            <a
              href="/roofing-quoting-software"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Roofing quoting software</p>
              <p className="mt-1 text-sm text-zinc-600">
                The full quote-to-invoice workflow for roofing contractors.
              </p>
            </a>
            <a
              href="/features/digital-roof-takeoff"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Digital roof takeoff</p>
              <p className="mt-1 text-sm text-zinc-600">
                Measure roof plans digitally with AI-assisted scanning.
              </p>
            </a>
            <a
              href="/features/ai-scan-assist"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">AI Scan Assist</p>
              <p className="mt-1 text-sm text-zinc-600">
                Automatic identification of roof areas, ridges, hips and valleys.
              </p>
            </a>
            <a
              href="/features/smart-components"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Smart Components&#8482;</p>
              <p className="mt-1 text-sm text-zinc-600">
                Reusable components that auto-apply materials and pricing to takeoff.
              </p>
            </a>
            <a
              href="/free-roofing-takeoff-builder"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Free takeoff builder</p>
              <p className="mt-1 text-sm text-zinc-600">
                Try the roof takeoff builder free, no signup required.
              </p>
            </a>
            <a
              href="/free-roofing-takeoff-calculator"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Free takeoff calculator</p>
              <p className="mt-1 text-sm text-zinc-600">
                Quick roof takeoff calculations, free to use.
              </p>
            </a>
            <a
              href="/blog/how-to-do-a-roof-takeoff"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">How to do a roof takeoff</p>
              <p className="mt-1 text-sm text-zinc-600">
                Step-by-step guide to measuring a roof from plans.
              </p>
            </a>
            <a
              href="/blog/how-to-measure-a-roof"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">How to measure a roof</p>
              <p className="mt-1 text-sm text-zinc-600">
                Methods and tools for accurate roof measurement.
              </p>
            </a>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-5xl">
            Measure. Price. Quote.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
            Stop doing takeoff in one tool and re-entering measurements into another. QuoteCore+ gives you one workflow from plan upload to final payment.
          </p>

          <a
            href="/free-trial"
            className="mt-10 inline-flex min-h-12 items-center justify-center rounded-full bg-black px-10 py-3 text-base font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
          >
            Start your free 14-day trial
          </a>

          <p className="mt-4 text-sm text-zinc-500">
            No card required. 14 days free.{" "}
            <a href="/pricing" className="underline hover:text-zinc-900">
              See pricing
            </a>
            .
          </p>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
