import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import DemoCTACard from "@/components/DemoCTACard";
import YouTubeLite from "@/components/YouTubeLite";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  // Root layout appends "| QuoteCore+" via template - do NOT add brand suffix here (avoids suffix doubling)
  title: "Contractor Estimating & Quoting Software for Construction — Free Trial",
  description:
    "Contractor estimating and quoting software for trades — build estimates and quotes from measurements, with digital takeoff, Smart Components, material ordering and invoicing. Free plan and 14-day free trial.",
  openGraph: {
    title: "Contractor Estimating & Quoting Software | QuoteCore+",
    description:
      "Contractor estimating and quoting software for trades — build estimates and quotes from measurements. Free plan and 14-day free trial.",
    url: "/construction-quoting-software",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/construction-quoting-software",
    languages: hreflangLanguages("/construction-quoting-software"),
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "QuoteCore+",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  keywords:
    "contractor quoting software, roofing quoting software, construction quoting software, digital takeoff, quote builder, material orders, Smart Components",
  description:
    "QuoteCore+ is construction quoting software for trades that work from measurements. It helps businesses measure jobs, build priced quotes, track customer approval, order materials, manage work, invoice and get paid in one connected workflow.",
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to manage a construction quote workflow with QuoteCore+",
  step: [
    {
      "@type": "HowToStep",
      name: "Measure or add the job details",
      text: "Start with site details, manual measurements, saved Smart Components™, or upload a plan and use AI Scan Assist to identify areas and components automatically. Keep the job information connected from the beginning.",
    },
    {
      "@type": "HowToStep",
      name: "Build the quote",
      text: "Use saved pricing rules, labour, materials, waste allowances, measurements and quote templates to build a professional quote.",
    },
    {
      "@type": "HowToStep",
      name: "Send and track approval",
      text: "Send the quote to the customer and track whether it is accepted or declined.",
    },
    {
      "@type": "HowToStep",
      name: "Order materials",
      text: "Use the accepted quote to support materials ordering without rebuilding the job manually.",
    },
    {
      "@type": "HowToStep",
      name: "Manage the work",
      text: "Keep customer details, notes, quote details, material information and job records organised in one place.",
    },
    {
      "@type": "HowToStep",
      name: "Invoice and get paid",
      text: "Move from quote to invoice and payment without starting again in another tool.",
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the difference between estimating and quoting?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An estimate is an approximate price based on measured quantities and your pricing rules — useful for ballparking a job before committing. A quote is a fixed, professional offer you stand behind. QuoteCore+ supports both: build the estimate from measurements, then turn it into a sent, trackable quote when the numbers are confirmed.",
      },
    },
    {
      "@type": "Question",
      name: "What trades can use QuoteCore+?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "QuoteCore+ can be used by construction and trade businesses that quote from measurements, plans, site details, materials and labour. That includes roofing, cladding, flooring, fencing, landscaping, decking, general building, renovation trades and exterior works.",
      },
    },
    {
      "@type": "Question",
      name: "Is QuoteCore+ only for roofing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. QuoteCore+ started from real roofing and construction workflow problems, but it is built for trade and construction businesses that need to quote, order, manage, invoice and get paid from one connected workflow.",
      },
    },
    {
      "@type": "Question",
      name: "Does QuoteCore+ only create quotes?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. QuoteCore+ helps with the wider workflow around the quote, including measurement, pricing, customer approval, materials ordering, job management, invoicing and payment.",
      },
    },
    {
      "@type": "Question",
      name: "Can I try it before paying?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. QuoteCore+ offers a 14-day free trial with no credit card required.",
      },
    },
    {
      "@type": "Question",
      name: "How much does construction quoting software cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "QuoteCore+ plans range from free to $59/month. The free plan includes core quoting features. Paid plans add digital takeoff, AI Scan Assist, material ordering, invoicing, and Smart Components. See our pricing page for current plan details.",
      },
    },
    {
      "@type": "Question",
      name: "Can QuoteCore+ be used for different trades?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. QuoteCore+ is used by roofing, cladding, flooring, fencing, landscaping, decking, and general building contractors. Any trade that quotes from measurements, plans, materials, and labour can use it. Smart Components let you save trade-specific pricing rules and reuse them across quotes.",
      },
    },
    {
      "@type": "Question",
      name: "How is QuoteCore+ different from spreadsheets?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Spreadsheets calculate numbers but disconnect the job — measurements, pricing, quotes, material orders, and invoices live in separate files. QuoteCore+ keeps the same job data connected from first measurement to final invoice, with Smart Components that remember your pricing rules so you don't rebuild formulas every time.",
      },
    },
    {
      "@type": "Question",
      name: "Does QuoteCore+ work for subcontractors?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Subcontractors who quote from plans or site measurements can use QuoteCore+ to build priced quotes, track customer approval, order materials, and invoice — all from the same job data. Smart Components are especially useful for subcontractors who repeat similar work across multiple jobs.",
      },
    },
    {
      "@type": "Question",
      name: "Can QuoteCore+ handle materials ordering?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Accepted quotes can be used to support materials ordering, so you do not have to copy the same job details from one place to another after the customer says yes.",
      },
    },
    {
      "@type": "Question",
      name: "Does QuoteCore+ include invoicing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. QuoteCore+ is designed to keep the job connected through to invoicing and payment, instead of stopping once the quote is accepted.",
      },
    },
  ],
};

const steps = [
  {
    number: "01",
    title: "Choose how you want to quote",
    body: "Start from a blank quote, use saved Smart Components™, or upload a plan and measure digitally. AI Scan Assist identifies roof areas and components from an uploaded plan automatically. QuoteCore+ gives you different ways to build the job depending on how you work.",
  },
  {
    number: "02",
    title: "Build the quote",
    body: "Use your saved materials, labour, measurements, waste allowances, pricing rules and templates to create a professional quote without rebuilding everything manually.",
  },
  {
    number: "03",
    title: "Send and track",
    body: "Send the quote to the customer and track what happens next. Know when a quote is accepted or declined so follow-up does not depend on memory.",
  },
  {
    number: "04",
    title: "Order materials",
    body: "Use the accepted quote to support materials ordering. Keep component details, quantities, drawings and custom lengths connected to the job.",
  },
  {
    number: "05",
    title: "Invoice",
    body: "Move from accepted quote to invoice without starting again. The job information is already there, so the admin does not need to be rebuilt in another tool.",
  },
  {
    number: "06",
    title: "Keep everything tracked",
    body: "Quotes, approvals, materials, invoices, customer details and job information stay connected instead of being spread across spreadsheets, emails, folders and notes.",
  },
];

const faqs = [
  {
    q: "What is the difference between estimating and quoting?",
    a: "An estimate is an approximate price based on measured quantities and your pricing rules — useful for ballparking a job before committing. A quote is a fixed, professional offer you stand behind. QuoteCore+ supports both: build the estimate from measurements, then turn it into a sent, trackable quote when the numbers are confirmed.",
  },
  {
    q: "What trades can use QuoteCore+?",
    a: "QuoteCore+ can be used by construction and trade businesses that quote from measurements, plans, site details, materials and labour. That includes roofing, cladding, flooring, fencing, landscaping, decking, general building, renovation trades and exterior works.",
  },
  {
    q: "Is QuoteCore+ only for roofing?",
    a: "No. QuoteCore+ started from real roofing and construction workflow problems, but it is built for trade and construction businesses that need to quote, order, manage, invoice and get paid from one connected workflow.",
  },
  {
    q: "Does QuoteCore+ only create quotes?",
    a: "No. QuoteCore+ helps with the wider workflow around the quote, including measurement, pricing, customer approval, materials ordering, job management, invoicing and payment.",
  },
  {
    q: "Can QuoteCore+ handle materials ordering?",
    a: "Yes. Accepted quotes can be used to support materials ordering, so you do not have to copy the same job details from one place to another after the customer says yes.",
  },
  {
    q: "Does QuoteCore+ include invoicing?",
    a: "Yes. QuoteCore+ is designed to keep the job connected through to invoicing and payment, instead of stopping once the quote is accepted.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes. QuoteCore+ offers a 14-day free trial with no credit card required.",
  },
  {
    q: "Who do I contact with questions?",
    a: "contact-link",
  },
  {
    q: "How much does construction quoting software cost?",
    a: "cost-link",
  },
  {
    q: "Can QuoteCore+ be used for different trades?",
    a: "Yes. QuoteCore+ is used by roofing, cladding, flooring, fencing, landscaping, decking, and general building contractors. Any trade that quotes from measurements, plans, materials, and labour can use it. Smart Components let you save trade-specific pricing rules and reuse them across quotes.",
  },
  {
    q: "How is QuoteCore+ different from spreadsheets?",
    a: "spreadsheets-link",
  },
  {
    q: "Does QuoteCore+ work for subcontractors?",
    a: "Yes. Subcontractors who quote from plans or site measurements can use QuoteCore+ to build priced quotes, track customer approval, order materials, and invoice — all from the same job data. Smart Components are especially useful for subcontractors who repeat similar work across multiple jobs.",
  },
];

const trades = [
  "Roofing",
  "Cladding",
  "Flooring",
  "Fencing",
  "Landscaping",
  "Decking",
  "General builders",
  "Renovation trades",
  "Exterior works",
  "Carpentry",
  "Plumbing",
  "Electrical",
];

const smartComponentItems = [
  "Materials",
  "Labour",
  "Waste allowances",
  "Measurements",
  "Drawings",
  "Images",
  "Area, length, pitch and angle calculations",
  "Pricing rules",
];

const videoSchemas = [
  {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "Create a Quote from Start to Finish with QuoteCore+",
    description: "Full walkthrough showing how to create a quote from start to finish using QuoteCore+.",
    thumbnailUrl: "https://i.ytimg.com/vi/pqIfx-rOcmo/maxresdefault.jpg",
    uploadDate: "2026-07-28",
    embedUrl: "https://www.youtube-nocookie.com/embed/pqIfx-rOcmo",
    contentUrl: "https://www.youtube.com/watch?v=pqIfx-rOcmo",
  },
  {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "What are Smart Components in QuoteCore+",
    description: "A short overview of Smart Components in QuoteCore+ - reusable pricing, labour, waste and measurement rules.",
    thumbnailUrl: "https://i.ytimg.com/vi/aFXJwOiliPI/maxresdefault.jpg",
    uploadDate: "2026-07-28",
    embedUrl: "https://www.youtube-nocookie.com/embed/aFXJwOiliPI",
    contentUrl: "https://www.youtube.com/watch?v=aFXJwOiliPI",
  },
];

export default function ConstructionQuotingSoftwarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {videoSchemas.map((v) => (
        <script key={v.contentUrl} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(v) }} />
      ))}

      <main className="min-h-screen bg-white text-zinc-950">
       <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Construction Quoting Software" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-16 pt-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.10),transparent_34%)]" />

          <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
              Construction Quoting Software
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Quoting software for contractors who work from measurements.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 sm:text-xl">
              Measure jobs with digital takeoff and AI Scan Assist, build priced quotes with Smart Components™, track customer approval, order materials, manage work, invoice and get paid - all in one connected workflow.
            </p>

            <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-left">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#FF6B35]">
                Quick answer
              </p>
              <p className="text-sm leading-6 text-zinc-600">
                Quoting software for contractors turns measurements, labour and material prices into a professional, priced quote — without spreadsheets or re-typed numbers. It is built for contractors, builders, roofers, plasterers and subcontractors who quote from measurements or plans. QuoteCore+ starts free (Lite plan), with paid plans from $19/month and a 14-day free trial — so you can send your first professional quote before paying anything.
              </p>
            </div>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="/free-trial"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-black px-8 py-3 text-base font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
              >
                Start free 14-day trial
              </a>

              <a
                href="https://calendly.com/quote-core-info/15-minute-meeting"
                target="_blank"
                rel="noopener noreferrer"
                className="pill-shimmer inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-8 py-3 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
              >
                Book a 15-minute call
              </a>
            </div>

            <p className="mt-3 text-sm text-zinc-400">No card required. 14 days free.</p>

            <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-600">
              <span className="font-semibold text-zinc-950">Simple pricing:</span>
              <a href="/pricing" className="hover:text-[#FF6B35] hover:underline">Free Lite plan</a>
              <span className="text-zinc-300">·</span>
              <a href="/pricing" className="hover:text-[#FF6B35] hover:underline">Starter $19/mo</a>
              <span className="text-zinc-300">·</span>
              <a href="/pricing" className="hover:text-[#FF6B35] hover:underline">Pro $39/mo</a>
              <span className="text-zinc-300">·</span>
              <a href="/pricing" className="hover:text-[#FF6B35] hover:underline">Pro Plus $59/mo</a>
            </div>
          </div>
        </section>

        {/* What is contractor quoting software */}
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">What is contractor quoting software?</h2>
          <p className="mt-6 text-lg leading-8 text-zinc-600">
            Contractor quoting software is a tool that turns job measurements, labour and material prices into a professional, priced quote — or estimate — without spreadsheets or re-typed numbers. Instead of rebuilding formulas for every job, contractors save their pricing rules once and reuse them, so the typical workflow becomes <strong className="text-zinc-950">estimate → quote → order → invoice</strong> in one connected place.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Construction estimating and quoting software goes further than a quote template: it connects measurement (manual or digital takeoff from plans), pricing, customer approval, material ordering and invoicing to the same job data. Job quoting software for trades like roofing, carpentry and plastering is built around this measured-work workflow, which is what separates it from generic invoicing apps.
          </p>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            If you currently price jobs in a spreadsheet, see our guide to <a href="/blog/how-to-do-a-roof-takeoff" className="text-[#BD4A1A] hover:underline">how to do a roof takeoff</a> for the measurement side, or the <a href="/blog/construction-estimating-spreadsheet-alternative" className="text-[#BD4A1A] hover:underline">construction estimating spreadsheet alternative</a> walkthrough for moving your pricing across without starting from scratch.
          </p>
        </section>

        {/* Problem section */}
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Stop running one job through five different tools.
          </h2>

          <p className="mt-6 text-lg leading-8 text-zinc-600">
            Most construction businesses do not only lose time creating the quote. They lose time because the job gets rebuilt at every stage.
          </p>

          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Measurements go into notes. Pricing sits in a spreadsheet. The quote gets formatted somewhere else. Materials are ordered from another document. Job details live in emails. Invoices are created after everything has already been copied three times.
          </p>

          <p className="mt-5 text-lg leading-8 text-zinc-600">
            That is where mistakes creep in. That is where follow-up gets missed. That is where jobs feel harder to manage than they should.
          </p>

          <p className="mt-5 text-lg font-semibold text-zinc-950">
            QuoteCore+ keeps the job connected from quote to payment.
          </p>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-16 lg:px-8">
          <DemoCTACard location="construction_quoting_software_intro" />
        </section>

        {/* Pricing clarity */}
        <section className="mx-auto max-w-4xl px-6 pb-16 lg:px-8">
          <div className="rounded-[2rem] border border-zinc-200 bg-zinc-50 px-7 py-8">
            <h2 className="text-2xl font-semibold text-zinc-950">How much does it cost?</h2>
            <p className="mt-3 text-zinc-600">Simple monthly plans in USD. Start with a 14-day full-feature free trial — no credit card required.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                { name: "Lite", price: "Free", note: "Core quoting" },
                { name: "Starter", price: "$19/mo", note: "Quoting + templates" },
                { name: "Pro", price: "$39/mo", note: "Takeoff + AI Scan Assist" },
                { name: "Pro Plus", price: "$59/mo", note: "Everything included" },
              ].map((p) => (
                <div key={p.name} className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
                  <p className="text-sm font-semibold text-zinc-950">{p.name}</p>
                  <p className="mt-1 text-xl font-semibold text-[#BD4A1A]">{p.price}</p>
                  <p className="mt-1 text-xs text-zinc-500">{p.note}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-zinc-500">See the <a href="/pricing" className="text-[#BD4A1A] hover:underline">full pricing comparison</a> for everything included in each plan.</p>
          </div>
        </section>

        {/* Trade-by-trade sections */}
        <section id="trades" className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">Quoting software built for your trade.</h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600">Whatever trade you work in, the job is the same: measure it, price it, quote it, and get paid. Here is how QuoteCore+ fits the way each trade works.</p>

          <div className="mt-10 space-y-5">
            {[
              { slug: "roofing", title: "Roofing contractors", body: <>Roofing quoting is measurement-heavy: roof areas, ridges, hips, valleys, barges, waste allowances and material pricing per square. QuoteCore+ includes <a href="/features/digital-roof-takeoff" className="text-[#BD4A1A] hover:underline">digital roof takeoff</a> with AI Scan Assist to identify roof areas and components from an uploaded plan, and Smart Components™ that store your per-square pricing, labour and waste rules so re-roof and repair quotes build in minutes. See the dedicated <a href="/roofing-quoting-software" className="text-[#BD4A1A] hover:underline">roofing quoting software</a> and <a href="/roofing-estimating-software" className="text-[#BD4A1A] hover:underline">roofing estimating software</a> pages.</> },
              { slug: "carpentry", title: "Carpentry", body: <>Carpentry quotes mix materials (timber, fixings, sheet goods), labour hours and often repeated assemblies — decks, pergolas, framing packages. Save each assembly once as a Smart Component™ with its materials list, labour and pricing rule, then drop it into the next quote and adjust quantities. Measure on site or from plans, then let the quote update from the measurements.</> },
              { slug: "plastering", title: "Plastering", body: <>Plastering quotes come from wall and ceiling areas, openings deducted, coats and finishes priced per area, and materials like plasterboard, compound and tape ordered by the job. Build Smart Components™ per finish type, quote from measured areas, and turn the accepted quote into a material order without re-keying anything.</> },
              { slug: "subcontractors", title: "Subcontractors", body: <>Subcontractors quote from head-contractor plans, then need to move fast: price it, submit it, and if accepted, order materials and invoice without admin overhead. QuoteCore+ keeps takeoff, quote, <a href="/features/material-ordering" className="text-[#BD4A1A] hover:underline">material orders</a> and <a href="/features/invoicing" className="text-[#BD4A1A] hover:underline">invoicing</a> connected to the same job data — especially valuable when you repeat similar work across multiple jobs.</> },
              { slug: "general-contractors", title: "General contractors", body: <>General builders juggle multiple trades, materials and suppliers on every quote. QuoteCore+ lets you build quotes from a library of trade-specific Smart Components™, keep every customer and job in one place, track which quotes are accepted, and move the winners straight through to material orders and invoices — instead of rebuilding the job in spreadsheets at every stage.</> },
            ].map((t) => (
              <div key={t.slug} id={t.slug} className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6 shadow-sm">
                <h3 className="text-xl font-semibold text-zinc-950">{t.title}</h3>
                <p className="mt-3 text-base leading-7 text-zinc-600">{t.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contractor evaluation criteria */}
        <section className="mx-auto max-w-4xl px-6 pb-16 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">How contractors evaluate quoting software.</h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600">Before choosing job quoting software, most contractors weigh the same four things. Here is how QuoteCore+ handles each.</p>
          <div className="mt-8 space-y-4">
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 shadow-sm">
              <h3 className="text-xl font-semibold text-zinc-950">Quotes per week: will it keep up with your volume?</h3>
              <p className="mt-3 text-base leading-7 text-zinc-600">Whether you send 2 quotes a week or 20, the bottleneck is the same: rebuilding the same measurements, materials and labour pricing every time. Smart Components™ store your pricing rules once, then drop them into every new quote — so quoting volume scales without your admin hours scaling with it.</p>
            </div>
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 shadow-sm">
              <h3 className="text-xl font-semibold text-zinc-950">Material lists: can the quote become an order?</h3>
              <p className="mt-3 text-base leading-7 text-zinc-600">A quote that can&apos;t be ordered from is only half a job. In QuoteCore+, the accepted quote drives <a href="/features/material-ordering" className="text-[#BD4A1A] hover:underline">materials ordering</a> directly — component quantities, drawings and custom lengths stay connected, with no copy-paste into a separate spreadsheet.</p>
            </div>
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 shadow-sm">
              <h3 className="text-xl font-semibold text-zinc-950">Follow-ups: do you know which quotes are still open?</h3>
              <p className="mt-3 text-base leading-7 text-zinc-600">Most lost jobs are lost to silence, not to competitors. QuoteCore+ tracks whether each quote has been viewed, accepted or declined, so follow-up is a list you work — not a feeling. For scripts and timing, see our guide on <a href="/blog/how-to-follow-up-on-a-quote" className="text-[#BD4A1A] hover:underline">how to follow up on a quote</a>.</p>
            </div>
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 shadow-sm">
              <h3 className="text-xl font-semibold text-zinc-950">Client-facing PDF: will customers trust the document?</h3>
              <p className="mt-3 text-base leading-7 text-zinc-600">Homeowners, developers and project managers judge professionalism quickly. Quotes export as clean, branded PDF documents generated from live job data — not a spreadsheet printout — which helps the quote get taken seriously before your price is even compared.</p>
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">QuoteCore+ vs spreadsheets vs generic invoicing tools.</h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">Spreadsheets calculate. Invoicing apps bill. Neither keeps the whole job connected. Here is the honest comparison.</p>
            <div className="mt-8 overflow-x-auto rounded-[1.5rem] border border-zinc-200 bg-white">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-5 py-4 font-semibold text-zinc-950">Capability</th>
                    <th className="px-5 py-4 font-semibold text-zinc-950">QuoteCore+</th>
                    <th className="px-5 py-4 font-semibold text-zinc-950">Spreadsheets</th>
                    <th className="px-5 py-4 font-semibold text-zinc-950">Generic invoicing tools</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {[
                    ["Measure from plans / digital takeoff", "Yes — built-in, with AI Scan Assist", "No — separate tool or manual", "No"],
                    ["Reusable trade pricing rules", "Yes — Smart Components™", "Fragile formulas you rebuild", "No"],
                    ["Professional quote output", "Yes — from live job data", "Manual formatting each time", "Basic templates"],
                    ["Quote-to-material-order flow", "Yes — from the accepted quote", "Copy-paste into a new sheet", "No"],
                    ["Quote-to-invoice flow", "Yes — same job data", "Rebuild manually", "Yes — but quote side is basic"],
                    ["Approval and follow-up tracking", "Yes — accepted / declined per quote", "Your memory or another sheet", "Limited"],
                    ["Works offline / field-friendly", "Web-based, measure on screen", "Yes", "Varies"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td className="px-5 py-4 font-medium text-zinc-900">{row[0]}</td>
                      <td className="px-5 py-4 text-zinc-700"><span className="mr-2 font-bold text-[#FF6B35]">✓</span>{row[1]}</td>
                      <td className="px-5 py-4 text-zinc-600">{row[2]}</td>
                      <td className="px-5 py-4 text-zinc-600">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-zinc-500">For a deeper walkthrough, see <a href="/blog/roofing-quoting-software-vs-spreadsheets" className="text-[#BD4A1A] hover:underline">quoting software vs spreadsheets</a>.</p>
          </div>
        </section>

        {/* Product screenshots */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">See the platform.</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {[
              { src: "/images/features/digital-roof-takeoff.png", alt: "Digital roof takeoff in QuoteCore+ — measure roof areas and components on an uploaded plan", caption: "Digital takeoff — measure plans on screen" },
              { src: "/images/features/smart-components-quote.png", alt: "Smart Components in a QuoteCore+ quote — reusable pricing, labour and waste rules", caption: "Smart Components™ — your pricing, reusable" },
              { src: "/images/features/material-ordering.png", alt: "Material ordering from an accepted quote in QuoteCore+", caption: "Material orders from accepted quotes" },
              { src: "/images/features/invoicing.png", alt: "Invoicing in QuoteCore+ — turn an accepted quote into an invoice", caption: "Invoicing without re-keying the job" },
            ].map((img) => (
              <figure key={img.src} className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm">
                <img src={img.src} alt={img.alt} className="w-full object-cover" loading="lazy" />
                <figcaption className="px-5 py-3 text-sm text-zinc-600">{img.caption}</figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-10 text-center">
            <a href="/free-trial" className="inline-flex min-h-12 items-center justify-center rounded-full bg-black px-8 py-3 text-base font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]">Start free 14-day trial</a>
            <p className="mt-3 text-sm text-zinc-400">No card required. 14 days free.</p>
          </div>
        </section>

        {/* What QuoteCore+ does */}
        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Measure. Quote. Order. Manage. Invoice. Get paid.
            </h2>

            <p className="mt-4 text-lg leading-8 text-zinc-600">
              QuoteCore+ helps businesses turn measurements, pricing, approvals, materials, job details, invoices and payment into one connected workflow.
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

        {/* Workflow video */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            See the quote workflow in practice.
          </h2>

          <p className="mt-6 text-lg leading-8 text-zinc-600">
            This walkthrough shows how QuoteCore+ helps turn job details and measurements into a professional quote, while keeping the job information ready for the next steps.
          </p>

          <div className="mt-8">
            <YouTubeLite
              videoId="pqIfx-rOcmo"
              title="Create a quote from start to finish with QuoteCore+"
              start={3}
              className="w-full"
            />
          </div>
        </section>

        {/* Smart Components™ */}
        <section id="smart-components" className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
              Smart Components™
            </p>

            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              QuoteCore+ remembers how you work.
            </h2>

            <p className="mt-6 text-lg leading-8 text-zinc-600">
              Most construction businesses already know how they price jobs. The problem is that knowledge is scattered across spreadsheets, old quotes, memory, photos, folders and notes.
            </p>

            <p className="mt-4 text-lg leading-8 text-zinc-600">
              Smart Components™ give that knowledge a proper home. Save the parts of a job you use again and again, then reuse them across future quotes, materials and job workflows.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {smartComponentItems.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-zinc-700 shadow-sm">
                  <span className="mt-1 shrink-0 font-bold text-[#FF6B35]">✓</span>
                  {item}
                </div>
              ))}
            </div>

            <p className="mt-8 text-base font-semibold text-zinc-950">
              Make them once. Reuse them in seconds.
            </p>

            <div className="mt-10">
              <h3 className="text-2xl font-semibold text-zinc-950">
                Watch Smart Components™ in action
              </h3>

              <p className="mt-4 text-lg leading-8 text-zinc-600">
                This tutorial shows how QuoteCore+ lets you save materials, labour, waste, measurements, drawings and pricing logic so the next quote is faster to build.
              </p>

              <div className="mt-6">
                <YouTubeLite
                  videoId="aFXJwOiliPI"
                  title="What are Smart Components in QuoteCore+"
                  start={3}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Built for trades that quote from measurements.
          </h2>

          <p className="mt-6 text-lg leading-8 text-zinc-600">
            QuoteCore+ is useful for businesses where a job starts with measurements, plans, materials, labour or a site visit, then needs to become a professional quote, approved job, materials order, invoice and payment.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "You quote from site measurements or plans",
              "You use spreadsheets, old quotes, Word documents or manual templates",
              "You lose time between enquiry, quote, approval and invoice",
              "You copy the same job details between different tools",
              "You need quotes to look professional without spending hours formatting them",
              "You want job information to stay connected after the customer says yes",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-zinc-700">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#FF6B35]" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-[2rem] border border-zinc-200 bg-zinc-50 p-8">
            <h3 className="text-xl font-semibold text-zinc-950">Trades who can use QuoteCore+</h3>

            <div className="mt-4 flex flex-wrap gap-2">
              {trades.map((trade) => {
                const tradeLinks: Record<string, string> = {
                  "Roofing": "/roofing-quoting-software",
                };
                const href = tradeLinks[trade];
                return href ? (
                  <a key={trade} href={href} className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm text-zinc-600 transition-colors hover:border-[#FF6B35] hover:text-[#FF6B35]">
                    {trade}
                  </a>
                ) : (
                  <span key={trade} className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm text-zinc-600">
                    {trade}
                  </span>
                );
              })}
            </div>

            <p className="mt-5 text-base font-medium text-zinc-800">
              If your work starts with a quote and needs to be managed through to payment, QuoteCore+ can help keep it together.
            </p>
          </div>
        </section>

        {/* Founder section */}
        <section className="bg-[#FF6B35]/5 py-16">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_20px_80px_rgba(0,0,0,0.06)]">
              <div className="p-10">
                <div className="mb-6 flex items-center gap-4">
                  <img
                    src="/shaun-smiling.jpg"
                    alt="Shaun"
                    className="h-14 w-14 shrink-0 rounded-full border-2 border-[#FF6B35]/20 object-cover"
                  />
                  <div>
                    <p className="font-semibold text-zinc-950">Shaun</p>
                    <p className="text-sm text-[#FF6B35]">Founder, QuoteCore+</p>
                  </div>
                </div>

                <h2 className="text-2xl font-semibold text-zinc-950">
                  Shaped by real construction workflow problems.
                </h2>

                <div className="mt-6 space-y-4 text-lg leading-8 text-zinc-600">
                  <p>
                    QuoteCore+ is led by Shaun&apos;s real experience across construction, roofing, project management and operations.
                  </p>

                  <p>
                    Shaun lived the problem: jobs spread across measurements, spreadsheets, quote documents, emails, material lists, follow-up notes and invoices.
                  </p>

                  <p>
                    The QuoteCore+ team built around that workflow to create a platform that is practical, flexible and designed to adapt to how trade businesses actually work.
                  </p>

                  <p>
                    The product started from roofing experience, but the problem is much wider than roofing. Construction and other measured trades can run into the same disconnected admin.
                  </p>

                  <p className="font-medium italic text-zinc-800">
                    “Software should adapt to your business. Not the other way around.”
                  </p>
                </div>
              </div>
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
                  <p className="mt-3 text-sm leading-7 text-zinc-600">
                    {f.a === "contact-link" ? (
                      <>
                        Email{" "}
                        <a href="mailto:info@quote-core.com" className="text-[#FF6B35] hover:underline">
                          info@quote-core.com
                        </a>{" "}
                        or book a free{" "}
                        <a
                          href="https://calendly.com/quote-core-info/15-minute-meeting"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#FF6B35] hover:underline"
                        >
                          15-minute call with Shaun
                        </a>
                        .
                      </>
                    ) : f.a === "cost-link" ? (
                      <>
                        QuoteCore+ plans range from free to $59/month. The free plan includes core quoting features. Paid plans add digital takeoff, AI Scan Assist, material ordering, invoicing, and Smart Components. See our{" "}
                        <a href="/pricing" className="text-[#FF6B35] hover:underline">pricing page</a>{" "}
                        for current plan details.
                      </>
                    ) : f.a === "spreadsheets-link" ? (
                      <>
                        Spreadsheets calculate numbers but disconnect the job — measurements, pricing, quotes, material orders, and invoices live in separate files. QuoteCore+ keeps the same job data connected from first measurement to final invoice, with Smart Components that remember your pricing rules so you don&apos;t rebuild formulas every time. See our{" "}
                        <a href="/blog/roofing-quoting-software-vs-spreadsheets" className="text-[#FF6B35] hover:underline">roofing quoting software vs spreadsheets comparison</a>{" "}
                        for a detailed breakdown.
                      </>
                    ) : (
                      f.a
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="bg-zinc-50 py-16">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF6B35] text-white font-semibold">
                  GK
                </div>
                <div>
                  <p className="font-semibold text-zinc-950">Greg Kepp</p>
                  <p className="text-sm text-[#FF6B35]">Sky High Roofing</p>
                </div>
              </div>
              <p className="mt-6 text-lg leading-8 text-zinc-600">
                &ldquo;We haven&rsquo;t had to print out a roof plan since we started using QuoteCore+. I was sceptical at first, but once you get used to measuring everything on screen it&rsquo;s hard to imagine going back, not to mention its at least 4x faster than our old process. We&rsquo;re still only using a fraction of what the app offers but very happy so far&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* Honest limitations */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">What QuoteCore+ does not do</h2>
          <div className="mt-8 space-y-4">
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">No project management or scheduling</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">QuoteCore+ handles quoting, material ordering, and invoicing. It does not manage construction schedules, Gantt charts, or resource allocation.</p>
            </div>
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">No accounting or tax returns</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">Invoices are created and tracked, but QuoteCore+ does not handle VAT/GST returns, profit and loss, or balance sheets.</p>
            </div>
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">No payment processing</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">Invoices include payment instructions, but QuoteCore+ does not process card or bank payments directly.</p>
            </div>
          </div>
        </section>

        {/* Less suitable use */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">When QuoteCore+ may not be the right fit</h2>
          <div className="mt-8 space-y-4">
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">You only need basic quote templates</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">If you create a few quotes a month from a simple template and that works, QuoteCore+ may be more than you need. It adds the most value when you quote frequently across multiple trades and want a connected workflow.</p>
            </div>
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
              <p className="font-semibold text-zinc-950">You need full project management</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600">QuoteCore+ handles quoting through invoicing, not construction project management. If you need scheduling, Gantt charts, or resource allocation, use dedicated PM software.</p>
            </div>
          </div>
        </section>

        {/* Related */}
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">Related</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a href="/features/digital-roof-takeoff" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Digital roof takeoff</p>
              <p className="mt-1 text-sm text-zinc-600">Upload plans, measure digitally, and use AI Scan Assist.</p>
            </a>
            <a href="/features/smart-components" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Smart Components™</p>
              <p className="mt-1 text-sm text-zinc-600">Reusable pricing, labour, waste, and business rules.</p>
            </a>
            <a href="/features/material-ordering" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Material ordering</p>
              <p className="mt-1 text-sm text-zinc-600">Generate material orders from accepted quotes.</p>
            </a>
            <a href="/features/invoicing" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Invoicing</p>
              <p className="mt-1 text-sm text-zinc-600">Turn accepted quotes into professional invoices.</p>
            </a>
            <a href="/free-construction-calculator" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Free construction calculator</p>
              <p className="mt-1 text-sm text-zinc-600">Areas, timber lengths, and building materials.</p>
            </a>
            <a href="/free-quote-generator" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Free quote generator</p>
              <p className="mt-1 text-sm text-zinc-600">Create a professional quote for free, no signup required.</p>
            </a>
            <a href="/roofing-quoting-software" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Roofing quoting software</p>
              <p className="mt-1 text-sm text-zinc-600">Built specifically for roofing contractors - takeoff to invoice.</p>
            </a>
            <a href="/free-tools" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Free tools</p>
              <p className="mt-1 text-sm text-zinc-600">Calculators, quote generator, invoice generator - no signup required.</p>
            </a>
            <a href="/trust" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Trust and security</p>
              <p className="mt-1 text-sm text-zinc-600">How we protect your data and respect your business.</p>
            </a>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center lg:px-8">
          <h2 className="text-3xl font-semibold sm:text-5xl">
  Quote. Manage. Grow.
</h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
            Stop managing one job with five different apps. QuoteCore+ gives construction and trade businesses one connected workflow from first quote to final payment.
          </p>

          <a
            href="/free-trial"
            className="mt-10 inline-flex min-h-12 items-center justify-center rounded-full bg-black px-10 py-3 text-base font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
          >
            Start your free 14-day trial
          </a>

          <p className="mt-4 text-sm text-zinc-400">No card required. 14 days free. <a href="/pricing" className="underline hover:text-zinc-900">See pricing</a>.</p>
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
