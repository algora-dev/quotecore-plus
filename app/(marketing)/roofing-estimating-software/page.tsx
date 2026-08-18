import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import DemoCTACard from "@/components/DemoCTACard";
import {
  buildSoftwareApplicationSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  siteUrl,
} from "@/lib/schema";

export const metadata: Metadata = {
  title: "Roofing Estimating Software | QuoteCore+",
  description:
    "Roofing estimating software with digital takeoff, AI Scan Assist, and Smart Components. Measure roofs, calculate materials and labour, and build accurate estimates. Plans from free to $59/month.",
  openGraph: {
    title: "Roofing Estimating Software | QuoteCore+",
    description:
      "Roofing estimating software with digital takeoff, AI Scan Assist, and Smart Components. Measure roofs, calculate materials and labour, and build accurate estimates. Plans from free to $59/month.",
    url: "/roofing-estimating-software",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/roofing-estimating-software",
  },
};

const faqs = [
  {
    question: "Can QuoteCore+ estimate roofing materials from a plan?",
    answer:
      "Yes. Upload a roof plan and use digital takeoff tools or AI Scan Assist to identify roof areas, ridges, hips, valleys, barges and spouting. Measurements feed directly into Smart Components, which apply your stored materials, quantities, waste allowances and pricing rules to produce a material estimate automatically.",
  },
  {
    question: "How accurate is AI Scan Assist for estimating?",
    answer:
      "AI Scan Assist identifies roof areas, ridges, hips, valleys, barges and spouting from an uploaded plan. It speeds up the measuring process significantly, but results should always be reviewed and adjusted manually before finalising an estimate. QuoteCore+ gives you full control to correct any measurement before it becomes part of a quote.",
  },
  {
    question: "Can I reuse estimating rules across jobs?",
    answer:
      "Yes. Smart Components let you save materials, labour, waste allowances, pitch calculations, drawings and pricing rules as reusable building blocks. Once configured, the same components can be dropped into any future estimate, so you are not rebuilding pricing logic from scratch for every job.",
  },
  {
    question: "Does QuoteCore+ handle waste allowances?",
    answer:
      "Yes. Waste allowances can be built into Smart Components as a percentage or fixed quantity. When a component is used in an estimate, the waste is calculated automatically and included in the material quantities and pricing.",
  },
  {
    question: "Can I estimate labour costs, not just materials?",
    answer:
      "Yes. Smart Components can store labour rules alongside materials. Labour rates, time estimates and crew sizing can all be configured per component, so labour costs are calculated automatically as part of the estimate.",
  },
  {
    question: "How is estimating different from quoting in QuoteCore+?",
    answer:
      "Estimating is the process of measuring, calculating quantities and pricing a job. Quoting is turning that estimate into a professional document you send to a customer for approval. In QuoteCore+, both happen in one connected workflow: your measurements and pricing become a quote without manual re-entry, and the same data carries through to material orders and invoices.",
  },
];

const faqSchema = buildFaqSchema(faqs);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "Roofing Estimating Software", url: `${siteUrl}/roofing-estimating-software` },
]);

const softwareSchema = {
  "@context": "https://schema.org",
  ...buildSoftwareApplicationSchema(),
};

const estimatingSteps = [
  {
    number: "01",
    title: "Upload plans or use AI scan",
    body: "Upload a roof plan, satellite image or drawing. Use AI Scan Assist to identify roof areas, ridges, hips, valleys, barges and spouting automatically, or measure manually with digital takeoff tools.",
  },
  {
    number: "02",
    title: "Measure roof areas, lengths and pitch",
    body: "Name each roof area, assign pitch and material type. Digital takeoff handles angles, pitches and complex roof geometry. Adjust any measurement manually before moving to pricing.",
  },
  {
    number: "03",
    title: "Smart Components apply materials, labour, waste and pricing",
    body: "Measurements feed directly into Smart Components, which apply your saved materials, labour rates, waste allowances and pricing rules automatically. No manual re-entry, no spreadsheet formulas.",
  },
  {
    number: "04",
    title: "Review, adjust and send as a quote",
    body: "Check the estimate, adjust quantities or pricing, then send it to the customer as a professional quote. The same data carries through to material orders and invoices if the quote is accepted.",
  },
];

const whatItEstimates = [
  "Roof areas (m², sq ft, roofing squares)",
  "Ridge, hip, valley and barge lengths",
  "Spouting and guttering lengths",
  "Material quantities with waste allowances",
  "Labour costs based on your rates",
  "Pitch-adjusted surface areas",
];

const limitations = [
  {
    title: "No CRM or lead generation",
    body: "QuoteCore+ handles the estimating-to-invoice workflow. It does not manage sales pipelines, marketing campaigns, or customer acquisition.",
  },
  {
    title: "No accounting or tax returns",
    body: "Estimates and invoices are created and tracked, but QuoteCore+ does not handle VAT/GST returns, profit and loss, or balance sheets. Use accounting software for that.",
  },
  {
    title: "No payment processing",
    body: "Invoices include payment instructions, but QuoteCore+ does not process card or bank payments directly. Customers pay via bank transfer, Stripe links or PayPal links configured per invoice.",
  },
];

const notRightFit = [
  {
    title: "You only need a basic material calculator",
    body: "If you estimate a few jobs a month with a simple spreadsheet or calculator and that works for you, QuoteCore+ may be more than you need. It adds the most value when you estimate frequently and want a connected workflow from measurement to invoice.",
  },
  {
    title: "You need full project management",
    body: "QuoteCore+ handles estimating, quoting, material ordering and invoicing, not construction project management. If you need scheduling, Gantt charts, or resource allocation, use dedicated project management software.",
  },
];

export default function RoofingEstimatingSoftwarePage() {
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
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Roofing Estimating Software" }]} />

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
              Roofing estimating software that measures, calculates, and prices in one workflow.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 sm:text-xl">
              Measure roofs digitally with AI Scan Assist, calculate materials and labour automatically with Smart Components&#8482;, and turn estimates into quotes without re-entering data. Plans from free to $59/month.
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

        {/* What is roofing estimating software? */}
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            What is roofing estimating software?
          </h2>

          <p className="mt-6 text-lg leading-8 text-zinc-700">
            Roofing estimating software helps contractors measure roof areas, calculate material quantities, apply labour costs, and produce accurate pricing for a job before a quote is sent.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Traditional estimating often means scaling rulers on paper plans, entering numbers into spreadsheets, and manually calculating waste, pitch adjustments and material counts. Every step is a chance for an error, and the same calculations get repeated on every job.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            QuoteCore+ replaces that process with a connected estimating workflow. Digital takeoff tools measure the roof. Smart Components&#8482; apply your stored materials, labour, waste and pricing rules automatically. The estimate becomes a quote without manual re-entry, and the same data carries through to material orders and invoices.
          </p>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-16 lg:px-8">
          <DemoCTACard location="roofing_estimating_software_intro" />
        </section>

        {/* Key estimating features */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Key estimating features
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              The tools that make estimating faster and more accurate in QuoteCore+.
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
                  Automatically identifies roof areas, ridges, hips, valleys, barges and spouting from an uploaded plan. Review and adjust before pricing.
                </p>
              </a>
              <a
                href="/features/smart-components"
                className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6 transition-all hover:border-orange-200 hover:bg-orange-50/40"
              >
                <h3 className="text-xl font-semibold">Smart Components&#8482;</h3>
                <p className="mt-3 text-zinc-600">
                  Save materials, labour, waste, pitch calculations and pricing rules as reusable components. Drop them into any estimate.
                </p>
              </a>
              <a
                href="/features/material-ordering"
                className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6 transition-all hover:border-orange-200 hover:bg-orange-50/40"
              >
                <h3 className="text-xl font-semibold">Material ordering</h3>
                <p className="mt-3 text-zinc-600">
                  Turn estimate quantities into a material order with supplier details carried over. No re-keying from the quote.
                </p>
              </a>
            </div>
          </div>
        </section>

        {/* How estimating works */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            How estimating works in QuoteCore+
          </h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            From plan upload to priced estimate in four steps.
          </p>

          <div className="mt-12 flex flex-col gap-5">
            {estimatingSteps.map((s) => (
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

        {/* What QuoteCore+ estimates */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              What QuoteCore+ estimates
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              Roofing-specific measurement types handled by the estimating workflow.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {whatItEstimates.map((item) => (
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

        {/* When it may not fit */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            When QuoteCore+ may not be the right fit
          </h2>
          <div className="mt-8 space-y-4">
            {notRightFit.map((n) => (
              <div
                key={n.title}
                className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5"
              >
                <p className="font-semibold text-zinc-950">{n.title}</p>
                <p className="mt-2 text-sm leading-7 text-zinc-600">{n.body}</p>
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
              href="/roofsnap-alternative"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">RoofSnap alternative</p>
              <p className="mt-1 text-sm text-zinc-600">
                How the two roofing measure-and-quote workflows compare.
              </p>
            </a>
            <a
              href="/roofr-alternative"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Roofr alternative</p>
              <p className="mt-1 text-sm text-zinc-600">
                Broad roofing CRM vs focused estimating workflow.
              </p>
            </a>
            <a
              href="/stack-alternative-for-roofing"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">STACK alternative for roofing</p>
              <p className="mt-1 text-sm text-zinc-600">
                Multi-trade estimating platform vs roofing-native workflow.
              </p>
            </a>
            <a
              href="/hover-alternative"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">HOVER alternative</p>
              <p className="mt-1 text-sm text-zinc-600">
                Generated 3D measurement vs owned plan takeoff.
              </p>
            </a>
            <a
              href="/bluebeam-alternative-for-roofing"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Bluebeam alternative for roofing</p>
              <p className="mt-1 text-sm text-zinc-600">
                Configurable PDF takeoff vs roofing-native estimating.
              </p>
            </a>
            <a
              href="/roofing-takeoff-software"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Roofing takeoff software</p>
              <p className="mt-1 text-sm text-zinc-600">
                Measure roof plans digitally and calculate material quantities.
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
              href="/construction-quoting-software"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Construction quoting software</p>
              <p className="mt-1 text-sm text-zinc-600">
                Quoting tools for construction and other measured trades.
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
                Reusable components that store pricing, labour, waste and quantities.
              </p>
            </a>
            <a
              href="/free-tools"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Free tools</p>
              <p className="mt-1 text-sm text-zinc-600">
                Roofing calculators, quote and invoice generators - free, no signup.
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
            <a
              href="/blog/how-much-roofing-material"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">How much roofing material</p>
              <p className="mt-1 text-sm text-zinc-600">
                Calculating material quantities for a roofing job.
              </p>
            </a>
            <a
              href="/blog/roofing-waste-calculation"
              className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <p className="font-semibold text-zinc-950">Roofing waste calculation</p>
              <p className="mt-1 text-sm text-zinc-600">
                How to calculate and apply waste allowances in estimates.
              </p>
            </a>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-5xl">
            Estimate. Quote. Build.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
            Stop estimating in spreadsheets and re-entering the same data into a quote. QuoteCore+ gives you one connected workflow from measurement to final payment.
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
