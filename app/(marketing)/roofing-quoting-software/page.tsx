import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import YouTubeLite from "@/components/YouTubeLite";
import { buildSoftwareApplicationSchema } from "@/lib/schema";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Roofing Quoting Software for Contractors | QuoteCore+",
  description:
    "QuoteCore+ helps roofing contractors measure jobs, build professional quotes, order materials, manage work, invoice clients and get paid - all in one connected workflow.",
  alternates: {
    canonical: "https://quote-core.com/roofing-quoting-software",
    languages: hreflangLanguages("/roofing-quoting-software"),
  },
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to manage a roofing job with QuoteCore+",
  step: [
    {
      "@type": "HowToStep",
      name: "Measure the job",
      text: "Upload a roof plan, measure digitally, or build from site details. Keep roof sections, lengths, areas, flashings, drawings and job information connected from the start.",
    },
    {
      "@type": "HowToStep",
      name: "Build the quote",
      text: "Turn measurements into a professional, priced quote using saved materials, labour, waste allowances, pricing rules and quote templates.",
    },
    {
      "@type": "HowToStep",
      name: "Send and track the quote",
      text: "Send the quote to the customer and track whether it has been accepted or declined.",
    },
    {
      "@type": "HowToStep",
      name: "Order materials",
      text: "Use the accepted quote to create materials orders without rebuilding the job from scratch.",
    },
    {
      "@type": "HowToStep",
      name: "Manage the job",
      text: "Keep customer information, job notes, quote details, materials and next steps organised in one place.",
    },
    {
      "@type": "HowToStep",
      name: "Invoice and get paid",
      text: "Move from accepted quote to invoice and payment without starting again.",
    },
  ],
};

const steps = [
  {
    number: "01",
    title: "Measure the job",
    body: "Upload a roof plan, measure digitally, or build from site details. Keep roof sections, lengths, areas, flashings, drawings and job information connected from the start.",
  },
  {
    number: "02",
    title: "Build the quote",
    body: "Turn measurements into a professional, priced quote using your saved materials, labour, waste allowances, pricing rules and quote templates.",
  },
  {
    number: "03",
    title: "Send and track",
    body: "Send the quote to the customer, then track whether it has been accepted or declined. No guessing, no lost email threads, no manual chasing list.",
  },
  {
    number: "04",
    title: "Order materials",
    body: "Use the accepted quote to create materials orders without rebuilding the job from scratch. Keep custom lengths, drawings and component details attached to the work.",
  },
  {
    number: "05",
    title: "Manage the job",
    body: "Once the quote is accepted, keep the job details, customer information, notes and next steps organised in one place.",
  },
  {
    number: "06",
    title: "Invoice and get paid",
    body: "Move from accepted quote to invoice without starting again. Keep the workflow connected from first measurement through to payment.",
  },
];

const bullets = [
  "Digital takeoffs and measurement workflows built around roofing",
  "Smart Components™ with materials, labour, waste, measurements, drawings, calculations and pricing rules",
  "Professional quotes that are clear for customers and easy to approve",
  "Materials ordering connected to accepted quotes",
  "Job details, invoices and payment workflow kept in one place",
  "Built for roofing first, flexible enough for wider construction work",
];

const faqs = [
  {
    q: "What is roofing quoting software?",
    a: "Roofing quoting software helps contractors turn measurements, materials, labour and pricing into professional quotes. QuoteCore+ goes further by keeping the workflow connected after the quote is sent, including approval tracking, materials ordering, job management, invoicing and payment.",
  },
  {
    q: "How is QuoteCore+ different from generic quoting tools?",
    a: "Most generic quoting tools help you create a quote document. QuoteCore+ is built around the full workflow roofing contractors deal with: measuring, pricing, quoting, customer approval, ordering materials, managing the job, invoicing and getting paid.",
  },
  {
    q: "Can QuoteCore+ help with roofing measurements?",
    a: "Yes. QuoteCore+ supports digital takeoffs and measurement-based quoting, so roof sections, lengths, areas, flashings and other job details can feed directly into the quote workflow.",
  },
  {
    q: "Does QuoteCore+ handle materials ordering?",
    a: "Yes. Accepted quotes can be used to support materials ordering, so you do not need to rebuild the same job details manually after the customer approves the quote.",
  },
  {
    q: "Does QuoteCore+ include invoicing?",
    a: "Yes. QuoteCore+ is designed to keep the job connected through to invoicing and payment, so the workflow does not stop once the quote is accepted.",
  },
  {
    q: "Is QuoteCore+ only for roofers?",
    a: "No. QuoteCore+ started with roofing because that is where the original workflow problem came from, but it is built for trade and construction businesses that quote from measurements and need to manage the job through to invoice and payment.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. QuoteCore+ offers a 14-day free trial with no credit card required.",
  },
];

export default function RoofingQuotingSoftwarePage() {
  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", ...buildSoftwareApplicationSchema() }) }}
    />

    <main className="min-h-screen bg-white text-zinc-950">
       <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Roofing Quoting Software" }]} />

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
              Roofing quoting software that keeps the whole job connected.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 sm:text-xl">
              Measure the roof, build the quote, send it to the customer, order materials, manage the job, invoice and get paid - all in one workflow.
            </p>

            <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-left">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#FF6B35]">
                Quick answer
              </p>
              <p className="text-sm leading-6 text-zinc-600">
                QuoteCore+ is roofing quoting software for contractors who want more than a quote template. It helps you move from measurements and pricing to customer approval, materials ordering, job management, invoicing and payment without rebuilding the same job information across spreadsheets, emails and documents.
              </p>
              <p className="mt-4 text-sm text-zinc-500">
                Built from roofing experience, but no longer limited to quoting only. QuoteCore+ supports the wider workflow from quote to payment.
              </p>
            </div>

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

        {/* Problem section */}
        <section className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
          <p className="text-lg leading-8 text-zinc-700">
            Most roofing businesses do not lose time because they cannot measure a roof.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            They lose time because the same job information gets rebuilt again and again. Measurements go into notes, then a spreadsheet, then a quote, then a materials order, then a job folder, then an invoice.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Every handover creates more admin. Every copy-and-paste creates another chance for something to be missed.
          </p>
          <p className="mt-5 text-lg font-semibold text-zinc-950">
            QuoteCore+ keeps the roofing job connected from first measurement to final invoice.
          </p>
        </section>

        {/* How it works */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              One clean workflow. Measure to paid.
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              QuoteCore+ helps roofers handle the full job journey: measure, quote, send, track approval, order materials, manage the work, invoice the client and get paid.
            </p>

            <div className="mt-12 flex flex-col gap-5">
              {steps.map((s) => (
                <div key={s.number} className="pill-shimmer rounded-[2rem] border border-zinc-200 bg-white px-7 py-6 shadow-sm">
                  <div className="flex items-start gap-6">
                    <span className="w-12 shrink-0 text-2xl font-semibold text-zinc-950">{s.number}</span>
                    <div>
                      <h3 className="text-xl font-semibold">{s.title}</h3>
                      <p className="mt-3 text-zinc-600">{s.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Smart Components™ */}
        <section id="smart-components" className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
            Smart Components™
          </p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
            Smart Components™ for roofing quotes
          </h2>

          <p className="mt-6 text-lg leading-8 text-zinc-600">
            Roofing quotes repeat more than people think. Roof sections, flashings, waste, pitch, labour, materials, drawings, measurements and pricing rules all come back again and again.
          </p>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            Smart Components™ let you save the way you build and price those parts of a job, then reuse them in future quotes without starting from scratch.
          </p>

          <p className="mt-6 text-base font-medium text-zinc-700">Use Smart Components™ for:</p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "Roof sections",
              "Flashings",
              "Labour rules",
              "Waste allowances",
              "Pitch and angle calculations",
              "Area and length calculations",
              "Drawings and images",
              "Materials and pricing logic",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-zinc-700">
                <span className="mt-1 shrink-0 font-bold text-[#FF6B35]">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-8 text-base font-medium text-zinc-700">
            Make the component once. Reuse it in quotes, materials and job workflows whenever the same type of work comes up again.
          </p>

          <div className="mt-10">
            <h3 className="text-2xl font-semibold text-zinc-950">Watch Smart Components™ in action</h3>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              This tutorial shows how QuoteCore+ lets you save roofing materials, labour, waste, pitch, measurements and pricing logic so you do not have to rebuild the same quote setup every time.
            </p>

            <div className="mt-6">
              <YouTubeLite
                videoId="XZSTIfGUHAU"
                title="How to set up Smart Components in QuoteCore+"
                start={3}
                className="w-full"
              />
            </div>
          </div>
        </section>

        {/* Why QuoteCore+ */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Built from roofing. Designed for the full job workflow.
          </h2>

          <p className="mt-6 text-lg leading-8 text-zinc-600">
            QuoteCore+ started with roofing because roofing makes quoting complicated fast. Measurements, pitch, waste, flashings, materials, labour, customer approvals and job details all need to line up.
          </p>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            Generic quoting tools often stop at the quote. QuoteCore+ is built for what happens before and after it too - from measurement and pricing through to materials, job management, invoicing and payment.
          </p>

          <ul className="mt-8 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-zinc-700">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#FF6B35]" />
                {b}
              </li>
            ))}
          </ul>
        </section>

        {/* Who it's for */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              For roofers who want quoting to connect to the rest of the job.
            </h2>

            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
                <h3 className="text-xl font-semibold">Solo roofers</h3>
                <p className="mt-4 text-zinc-600">
                  You quote the work, organise the materials, manage the customer and handle the invoice yourself. QuoteCore+ keeps that workflow together so you are not rebuilding the same job at every step.
                </p>
              </div>

              <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
                <h3 className="text-xl font-semibold">Roofing teams</h3>
                <p className="mt-4 text-zinc-600">
                  Keep quotes consistent, approvals visible, materials organised and job information easier to manage across the team. Everyone works from the same connected job record.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow proof */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            See the full quote workflow in practice.
          </h2>
          <p className="mt-6 text-lg leading-8 text-zinc-600">
            This walkthrough shows how QuoteCore+ helps create a roofing quote from start to finish, while keeping job information connected for the next steps.
          </p>

          <div className="mt-8">
            <YouTubeLite
              videoId="pqIfx-rOcmo"
              title="Create a roofing quote from start to finish with QuoteCore+"
              start={3}
              className="w-full"
            />
          </div>
        </section>

        {/* Honest limitations */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">What QuoteCore+ does not do</h2>
          <div className="mt-8 space-y-4">
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">No CRM or lead generation</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">QuoteCore+ handles the quoting-to-invoice workflow. It does not manage sales pipelines, marketing campaigns, or customer acquisition.</p>
            </div>
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">No accounting or tax returns</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">Invoices are created and tracked, but QuoteCore+ does not handle VAT/GST returns, profit and loss, or balance sheets. Use accounting software for that.</p>
            </div>
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">No payment processing</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">Invoices include payment instructions, but QuoteCore+ does not process card or bank payments. Customers pay via bank transfer using the details on the invoice.</p>
            </div>
          </div>
        </section>

        {/* Less suitable use */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">When QuoteCore+ may not be the right fit</h2>
          <div className="mt-8 space-y-4">
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">You only need basic quote templates</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">If you create a few quotes a month from a simple Excel template and that works for you, QuoteCore+ may be more than you need. It adds the most value when you quote frequently and want a connected workflow from measurement to invoice.</p>
            </div>
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">You need full project management</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">QuoteCore+ handles quoting, material ordering, and invoicing, not construction project management. If you need scheduling, Gantt charts, or resource allocation, use dedicated project management software.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">Common questions</h2>

            <div className="mt-10 space-y-4">
              {faqs.map((f) => (
                <div key={f.q} className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
                  <p className="font-semibold text-zinc-950">{f.q}</p>
                  <p className="mt-3 text-sm leading-7 text-zinc-600">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Related */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">Related</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a href="/features/digital-roof-takeoff" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Digital roof takeoff</p>
              <p className="mt-1 text-sm text-zinc-600">Measure roof plans digitally with AI-assisted scanning.</p>
            </a>
            <a href="/features/smart-components" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Smart Components</p>
              <p className="mt-1 text-sm text-zinc-600">Reusable components that store pricing, product codes, and quantities.</p>
            </a>
            <a href="/features/invoicing" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Invoicing</p>
              <p className="mt-1 text-sm text-zinc-600">Turn accepted quotes into professional invoices in one click.</p>
            </a>
            <a href="/free-roofing-calculator" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Free roofing calculator</p>
              <p className="mt-1 text-sm text-zinc-600">Pitch, rafter lengths, areas, and material quantities.</p>
            </a>
            <a href="/free-quote-generator" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Free quote generator</p>
              <p className="mt-1 text-sm text-zinc-600">Create a professional quote for free, no signup required.</p>
            </a>
            <a href="/customer-stories" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Customer stories</p>
              <p className="mt-1 text-sm text-zinc-600">Real contractors using QuoteCore+ in their workflow.</p>
            </a>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-5xl">
  Quote. Manage. Grow.
</h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
            Stop running one roofing job through five different tools. QuoteCore+ gives you one connected workflow from first measurement to final payment.
          </p>

          <a
            href="/free-trial"
            className="mt-10 inline-flex min-h-12 items-center justify-center rounded-full bg-black px-10 py-3 text-base font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
          >
            Start your free 14-day trial
          </a>

          <p className="mt-4 text-sm text-zinc-500">No card required. 14 days free. <a href="/pricing" className="underline hover:text-zinc-900">See pricing</a>.</p>
        </section>

        <SiteFooter />
      </main>

      <style>{`
        .pill-shimmer { position: relative; overflow: hidden; }
        .pill-shimmer::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(90deg, transparent 0%, transparent 40%, #ff6b35 50%, transparent 60%, transparent 100%);
          background-size: 200% 100%;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
          pointer-events: none;
        }
        .pill-shimmer:hover::before { opacity: 1; animation: shimmerBorder 1.5s linear infinite; }
        @keyframes shimmerBorder {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </>
  );
}
