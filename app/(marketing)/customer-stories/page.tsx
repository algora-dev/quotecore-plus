import type { Metadata } from "next";
import Script from "next/script";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Customer Stories",
  description:
    "Real stories from contractors using QuoteCore+ to quote faster, order materials, and get paid. See how roofing and construction businesses use the platform.",
  alternates: {
    canonical: "https://quote-core.com/customer-stories",
    languages: hreflangLanguages("/customer-stories"),
  },
  openGraph: {
    title: "Customer Stories",
    description:
      "Real stories from contractors using QuoteCore+ to quote faster, order materials, and get paid.",
    url: "https://quote-core.com/customer-stories",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Customer Stories", item: `${SITE_URL}/customer-stories` },
  ],
};

export default function CustomerStoriesPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Customer Stories" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Customer Stories</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Real contractors. Real workflows. Real results.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              We are collecting verified stories from roofing and construction contractors who use QuoteCore+ every day. Each story includes the problem they faced, how they use the platform, and measurable results.
            </p>
          </div>
        </section>

        {/* Empty state */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <div className="rounded-xl border-dashed border border-slate-200 px-6 py-12 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Stories coming soon</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-600">
              We do not publish fabricated testimonials or anonymous case studies. We are working with customers to document their experiences with verified results, screenshots, and permission.
            </p>
            <p className="mt-4 text-sm text-zinc-500">
              If you are a QuoteCore+ customer and would like to share your story, <a href="/contact" className="text-[#BD4A1A] hover:underline">get in touch</a>.
            </p>
          </div>
        </section>

        {/* What a story includes */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What each story includes</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">The problem</h3>
              <p className="mt-2 text-sm text-zinc-600">What the contractor struggled with before QuoteCore+ - slow quoting, lost measurements, manual invoicing.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">The workflow</h3>
              <p className="mt-2 text-sm text-zinc-600">How they use QuoteCore+ day to day - takeoff, quoting, material ordering, invoicing.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Measurable results</h3>
              <p className="mt-2 text-sm text-zinc-600">Time saved per quote, faster quote turnaround, fewer errors, improved cash flow.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Verified details</h3>
              <p className="mt-2 text-sm text-zinc-600">Customer name (with permission), trade, region, and real screenshots - not stock photos.</p>
            </div>
          </div>
        </section>

        {/* Related */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Related</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <a href="/about" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">About QuoteCore+</h3>
              <p className="mt-1 text-sm text-zinc-600">Built by Shaun, who spent 20 years in the trade.</p>
            </a>
            <a href="/features" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Features</h3>
              <p className="mt-1 text-sm text-zinc-600">See what QuoteCore+ does - from takeoff to invoice.</p>
            </a>
            <a href="/trust" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Trust and Security</h3>
              <p className="mt-1 text-sm text-zinc-600">How we protect your data and respect your business.</p>
            </a>
            <a href="/free-trial" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Start free trial</h3>
              <p className="mt-1 text-sm text-zinc-600">14 days, all features, no credit card required.</p>
            </a>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Try it yourself</h2>
            <p className="mt-2 text-zinc-600">14 days, all features, no credit card required.</p>
            <a href="/free-trial" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]">
              Start free trial
            </a>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
