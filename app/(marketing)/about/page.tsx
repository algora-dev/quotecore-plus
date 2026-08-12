import type { Metadata } from "next";
import Script from "next/script";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { hreflangLanguages } from "@/lib/seo/hreflang";
import { SITE_URL } from "@/lib/seo/site-url";
import { ORG_LINKEDIN } from "@/app/lib/seo";

export const metadata: Metadata = {
  title: "About QuoteCore+ | Built From the Roofing Industry",
  description: "The founder story behind QuoteCore+ — built by a contractor who spent 20 years on the tools and in the office, frustrated with partial quoting processes. The software he wished he had.",
  alternates: { canonical: "https://quote-core.com/about", languages: hreflangLanguages("/about") },
  openGraph: {
    title: "About QuoteCore+ | Built From the Roofing Industry",
    description: "The founder story behind QuoteCore+ — built by a contractor who spent 20 years on the tools and in the office, frustrated with partial quoting processes.",
    url: "https://quote-core.com/about",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Shaun",
  jobTitle: "Founder, QuoteCore+",
  description: "20 years of trade experience across the tools and the office. Founded QuoteCore+ to solve the quoting and job management problems he lived with.",
  url: `${SITE_URL}/about`,
  image: `${SITE_URL}/shaun.jpg`,
  worksFor: {
    "@type": "Organization",
    name: "QuoteCore+",
    legalName: "T3 Play Limited",
    url: `${SITE_URL}/`,
  },
  knowsAbout: [
    "Roofing estimation",
    "Construction quoting",
    "Digital takeoff",
    "Material pricing",
    "Roof measurement",
    "Trade business management",
  ],
  sameAs: [
    ORG_LINKEDIN,
    "https://www.youtube.com/@quotecoreplus",
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "About", item: `${SITE_URL}/about` },
  ],
};

export default function AboutPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
       <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">About QuoteCore+</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              The quoting software he wished he had.
            </h1>
          </div>
        </section>

        {/* Story */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">

          {/* Founder card */}
          <div className="flex items-center gap-6 rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
            <img src="/shaun.jpg" alt="" className="h-20 w-20 rounded-full object-cover border-2 border-[#FF6B35]/20" />
            <div>
              <p className="text-xl font-semibold">Shaun</p>
              <p className="text-sm text-zinc-500">Founder, QuoteCore+</p>
            </div>
          </div>

          {/* Story */}
          <div className="mt-12 space-y-6 leading-8 text-zinc-600">
            <p>
              For 20 years, Shaun split his time between the tools and the office - quoting jobs, managing projects, and trying every method available to keep the paperwork under control.
            </p>
            <p>
              He tried multiple approaches to quoting over the years. Most led to the same problem: using multiple apps, transferring figures between them, and losing numbers along the way. Some of the process was paper, some was digital, and none of it connected properly. It was always a mess.
            </p>
            <p>
              So he built QuoteCore+ - the software he would have wanted back when he was doing this work. One platform that takes you from measurement to quote to order to invoice, without re-entering a single number.
            </p>
            <p className="font-medium text-zinc-800">
              QuoteCore+ started in roofing because that was the hardest problem to solve. The same engine also handles construction and other measured trades.
            </p>
          </div>

          {/* Expertise */}
          <div className="mt-12 rounded-xl border border-slate-200 bg-white p-8">
            <h2 className="text-xl font-semibold">Areas of expertise</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Roofing estimation", "Construction quoting", "Digital takeoff", "Material pricing", "Roof measurement", "Trade business management"].map((area) => (
                <span key={area} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{area}</span>
              ))}
            </div>
          </div>

          {/* Company link */}
          <div className="mt-6">
            <a href="/company" className="text-sm font-semibold text-[#BD4A1A] hover:text-[#FF6B35]">
              View company information
            </a>
          </div>

          {/* CTA */}
          <div className="mt-10 rounded-[2rem] border border-[#FF6B35]/20 bg-[#FF6B35]/5 p-8 text-center">
            <p className="text-xl font-semibold text-zinc-950">See it for yourself.</p>
            <p className="mt-2 text-zinc-500">Two weeks free. No card required. Start quoting in minutes.</p>
            <a
              href="/free-trial"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-black px-10 py-3 text-base font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
            >
              Start your free trial
            </a>
            <p className="mt-4 text-sm text-zinc-500">
              <a href="/pricing" className="underline hover:text-zinc-900">See pricing</a> · <a href="/contact" className="underline hover:text-zinc-900">Contact us</a>
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
