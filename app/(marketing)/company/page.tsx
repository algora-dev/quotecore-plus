import type { Metadata } from "next";
import Script from "next/script";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { ORG_NAME, ORG_LEGAL_NAME, ORG_EMAIL, ORG_LINKEDIN } from "@/app/lib/seo";

export const metadata: Metadata = {
  title: "About QuoteCore+ | Construction Quoting Software Company",
  description:
    "QuoteCore+ is roofing and construction quoting software by T3 Play Limited. Learn about the company, who built it, and why trades contractors choose QuoteCore+.",
  alternates: {
    canonical: "https://quote-core.com/company",
  },
  openGraph: {
    title: "About QuoteCore+ | Construction Quoting Software Company",
    description:
      "QuoteCore+ is roofing and construction quoting software by T3 Play Limited. Learn about the company, who built it, and why trades contractors choose QuoteCore+.",
    url: "https://quote-core.com/company",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: ORG_NAME,
  legalName: ORG_LEGAL_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/MainQCP.png`,
  founder: {
    "@type": "Person",
    name: "Shaun",
    jobTitle: "Founder",
    description: "20 years of trade experience across the tools and the office. Founded QuoteCore+ to solve the quoting problems he lived with.",
    url: `${SITE_URL}/about`,
  },
  email: ORG_EMAIL,
  sameAs: [
    ORG_LINKEDIN,
    "https://www.youtube.com/@quotecoreplus",
  ],
  areaServed: [
    { "@type": "Country", name: "United Kingdom" },
    { "@type": "Country", name: "New Zealand" },
    { "@type": "Country", name: "Australia" },
    { "@type": "Country", name: "United States" },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Company", item: `${SITE_URL}/company` },
  ],
};

const facts = [
  { label: "Product", value: "QuoteCore+" },
  { label: "Legal entity", value: "T3 Play Limited" },
  { label: "Category", value: "Roofing and construction quoting software" },
  { label: "Founder", value: "Shaun - 20 years of trade experience" },
  { label: "Regions served", value: "United Kingdom, New Zealand, Australia, United States" },
  { label: "Supported trades", value: "Roofing, cladding, flooring, fencing, landscaping, general construction" },
  { label: "Pricing model", value: "Monthly subscription with 14-day free trial" },
  { label: "Support", value: "Email and in-app support" },
  { label: "Trial terms", value: "14 days, no credit card required" },
];

export default function CompanyPage() {
  return (
    <>
      <Script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Company" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Company</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              QuoteCore+ is roofing and construction quoting software built around measurements.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              QuoteCore+ connects digital takeoffs, pricing, customer approval, material ordering, job management, and invoicing in one platform. Built by T3 Play Limited.
            </p>
          </div>
        </section>

        {/* Company facts */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Company facts</h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <dl className="divide-y divide-slate-200">
              {facts.map((fact) => (
                <div key={fact.label} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-slate-500">{fact.label}</dt>
                  <dd className="text-sm text-slate-900 sm:col-span-2">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* What we do */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What QuoteCore+ does</h2>
          <div className="mt-6 space-y-4 leading-7 text-zinc-600">
            <p>
              QuoteCore+ helps contractors measure jobs, build professional quotes, track customer approvals, order materials, manage jobs, and invoice clients. The workflow moves from measurement to invoice in one connected platform.
            </p>
            <p>
              The software was built around roofing first, because roofing has some of the most complex measurement and pricing requirements in construction. Smart Components handle the angles, pitches, waste allowances, and material calculations that roofers deal with daily. That same engine adapts to other measured trades including cladding, flooring, fencing, and landscaping.
            </p>
          </div>
        </section>

        {/* Founder */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Founder</h2>
          <div className="mt-6 flex items-center gap-6 rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
            <img src="/shaun.jpg" alt="" className="h-20 w-20 rounded-full object-cover border-2 border-[#FF6B35]/20" />
            <div>
              <p className="text-xl font-semibold">Shaun</p>
              <p className="text-sm text-zinc-500">Founder, QuoteCore+</p>
              <p className="mt-1 text-sm font-medium text-[#FF6B35]">20 years in the trade</p>
            </div>
          </div>
          <p className="mt-6 leading-7 text-zinc-600">
            Shaun spent 20 years splitting his time between the tools and the office - quoting jobs, managing projects, and trying every method available to keep the paperwork under control. The process was always partially paper, partially digital, and numbers kept getting lost between apps. He built QuoteCore+ to be the software he wished he had: one connected platform from measurement to invoice.
          </p>
          <p className="mt-4">
            <a href="/about" className="text-sm font-semibold text-[#BD4A1A] hover:text-[#FF6B35]">
              Read the full founder story
            </a>
          </p>
        </section>

        {/* Regions */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Regions served</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">United Kingdom</h3>
              <p className="mt-2 text-sm text-zinc-600">Primary market. Pricing in GBP. Metric measurements.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">New Zealand</h3>
              <p className="mt-2 text-sm text-zinc-600">Dedicated NZ site at <a href="https://www.quote-core.co.nz" className="text-[#BD4A1A] hover:underline">quote-core.co.nz</a>. Pricing in NZD. GST included.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Australia</h3>
              <p className="mt-2 text-sm text-zinc-600">Supported via the global site. Pricing in USD with metric measurements.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">United States</h3>
              <p className="mt-2 text-sm text-zinc-600">Supported via the global site. Pricing in USD. Imperial measurements available.</p>
            </div>
          </div>
        </section>

        {/* Contact & Support */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Contact and support</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">General enquiries</h3>
              <p className="mt-2 text-sm text-zinc-600">Email <a href="mailto:info@quote-core.com" className="text-[#BD4A1A] hover:underline">info@quote-core.com</a></p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Support</h3>
              <p className="mt-2 text-sm text-zinc-600">Email support via the in-app help or contact form. Response during UK business hours.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Book a demo</h3>
              <p className="mt-2 text-sm text-zinc-600"><a href="https://calendly.com/quote-core-info/15-minute-meeting" target="_blank" rel="noopener noreferrer" className="text-[#BD4A1A] hover:underline">Book a 15-minute call with Shaun</a></p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">YouTube</h3>
              <p className="mt-2 text-sm text-zinc-600"><a href="https://www.youtube.com/@quotecoreplus" target="_blank" rel="noopener noreferrer" className="text-[#BD4A1A] hover:underline">Product demos and tutorials</a></p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Try QuoteCore+ free for 14 days</h2>
            <p className="mt-2 text-zinc-600">All features unlocked. No credit card required.</p>
            <a
              href="/free-trial"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
            >
              Start free trial
            </a>
            <p className="mt-4 text-sm text-zinc-500">
              <a href="/pricing" className="underline hover:text-zinc-900">See pricing</a>
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
