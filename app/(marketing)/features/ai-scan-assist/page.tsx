import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "AI Scan Assist for Roof Plans",
  description:
    "AI Scan Assist identifies multiple roof areas, ridges, hips, valleys, barges and spouting from your uploaded plan. Verify, adjust and swap components - then carry everything into your quote.",
  alternates: {
    canonical: "https://quote-core.com/features/ai-scan-assist",
    languages: hreflangLanguages("/features/ai-scan-assist"),
  },
  openGraph: {
    title: "AI Scan Assist for Roof Plans",
    description:
      "AI Scan Assist identifies roof areas, ridges, hips, valleys, barges and spouting from your uploaded plan. Verify, adjust and swap components.",
    url: "https://quote-core.com/features/ai-scan-assist",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "QuoteCore+ AI Scan Assist",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "AI roof plan scanning",
  operatingSystem: "Web",
  description: "AI Scan Assist identifies multiple roof areas, ridges, hips, valleys, barges and spouting from uploaded roof plans. Users verify, adjust, swap Smart Components and carry everything into a priced quote.",
  url: `${SITE_URL}/features/ai-scan-assist`,
  publisher: { "@id": `${SITE_URL}/#organization` },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "14-day free trial with 20 AI scan points included, no credit card required" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Features", item: `${SITE_URL}/features` },
    { "@type": "ListItem", position: 3, name: "AI Scan Assist", item: `${SITE_URL}/features/ai-scan-assist` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What does AI Scan Assist detect on a roof plan?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI Scan Assist identifies multiple roof outlines/areas (which you can name and assign different pitches, materials and components to), plus ridges/ridge capping, hips, valleys, barges and spouting. Each detected element is a placeholder you can swap to any saved Smart Component.",
      },
    },
    {
      "@type": "Question",
      name: "Can I correct what AI Scan Assist finds?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every detected element is a placeholder. You can adjust measurements, swap any placeholder to a different Smart Component via dropdown (quantities, labour, waste and pricing recalculate automatically), and add any components AI does not detect such as flashings, downpipes, parapet caps or change-of-pitch flashings.",
      },
    },
    {
      "@type": "Question",
      name: "Is AI Scan Assist required?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. AI Scan Assist is an optional accelerator. You can skip it entirely and use manual digital takeoff to draw everything yourself. Both paths produce the same result - a complete, priced roof takeoff.",
      },
    },
    {
      "@type": "Question",
      name: "How many AI scan points do I get?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The 14-day free trial includes 20 AI scan points. Paid plans include 50 (Pro) or 100 (Pro Plus) AI scan points. Additional scan points can be purchased if needed.",
      },
    },
  ],
};

const faqs = [
  { q: "What does AI Scan Assist detect on a roof plan?", a: "AI Scan Assist identifies multiple roof outlines/areas (which you can name and assign different pitches, materials and components to), plus ridges/ridge capping, hips, valleys, barges and spouting. Each detected element is a placeholder you can swap to any saved Smart Component." },
  { q: "Can I correct what AI Scan Assist finds?", a: "Yes. Every detected element is a placeholder. You can adjust measurements, swap any placeholder to a different Smart Component via dropdown (quantities, labour, waste and pricing recalculate automatically), and add any components AI does not detect such as flashings, downpipes, parapet caps or change-of-pitch flashings." },
  { q: "Is AI Scan Assist required?", a: "No. AI Scan Assist is an optional accelerator. You can skip it entirely and use manual digital takeoff to draw everything yourself. Both paths produce the same result - a complete, priced roof takeoff." },
  { q: "How many AI scan points do I get?", a: "The 14-day free trial includes 20 AI scan points. Paid plans include 50 (Pro) or 100 (Pro Plus) AI scan points. Additional scan points can be purchased if needed." },
];

export default function AIScanAssistPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Features", href: "/features" }, { label: "AI Scan Assist" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Feature</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              AI Scan Assist: from plan to priced takeoff in seconds.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Upload a roof plan and AI identifies multiple roof areas, ridges, hips, valleys, barges and spouting automatically. Name each area, assign different pitches and materials, then verify and adjust everything manually. Each detected element is a placeholder you can swap to any saved Smart Component.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="/free-trial" className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]">
                Start free trial
              </a>
              <Link href="/features" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40">
                All features
              </Link>
            </div>
            <p className="mt-3 text-sm text-zinc-500">14-day trial, 20 AI scan points included, no card required</p>
          </div>
        </section>

        {/* What AI detects */}
        <section className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">What AI Scan Assist detects</h2>
          <p className="mt-3 text-base text-zinc-600">
            AI identifies the core roofing elements. You verify, adjust and add anything else.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Roof areas (multiple)", desc: "Identifies separate roof outlines. Name each one, assign different pitch, material and component systems." },
              { name: "Ridges / ridge capping", desc: "Detects ridge lines. Placeholder you can swap to any saved ridge component." },
              { name: "Hips", desc: "Detects hip lines. Swap to any hip component - quantities, labour, waste and pricing recalculate." },
              { name: "Valleys", desc: "Detects valley lines. Swap component, adjust measurements as needed." },
              { name: "Barges", desc: "Detects barge edges. Placeholder for any barge component." },
              { name: "Spouting", desc: "Detects spouting positions. Swap to any spouting component." },
            ].map((item) => (
              <div key={item.name} className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all">
                <h3 className="text-base font-semibold text-zinc-950">{item.name}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-dashed border-zinc-200 px-6 py-8">
            <h3 className="text-base font-semibold text-zinc-950">What AI does NOT detect (you add manually)</h3>
            <p className="mt-2 text-sm text-zinc-600">After AI runs, add any components it doesn&apos;t find:</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Side flashings", "Change-of-pitch flashings", "Parapet cap flashings", "Downpipes", "Custom components", "Any saved Smart Component"].map((item) => (
                <span key={item} className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">{item}</span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works steps */}
        <section className="bg-zinc-50 py-12 lg:py-16">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { num: "1", title: "Upload plan", text: "Upload a roof plan PDF or image. AI Scan Assist starts from the same upload as manual takeoff." },
                { num: "2", title: "AI identifies elements", text: "AI detects roof areas, ridges, hips, valleys, barges and spouting. Each is a placeholder." },
                { num: "3", title: "Verify and swap", text: "Adjust measurements, swap any placeholder to a saved Smart Component. Quantities, labour, waste and pricing recalculate automatically." },
                { num: "4", title: "Add and carry to quote", text: "Add any non-detected components. Everything carries directly into your quote - no copy-pasting." },
              ].map((step) => (
                <div key={step.num} className="rounded-xl border border-zinc-200 bg-white p-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF6B35] text-sm font-semibold text-white">{step.num}</div>
                  <h3 className="mt-4 text-base font-semibold text-zinc-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI vs Manual */}
        <section className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">AI Scan Assist vs manual takeoff</h2>
          <p className="mt-3 text-base text-zinc-600">Both paths produce the same result. AI just gets you there faster.</p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-5 py-4 text-sm font-semibold text-zinc-900"></th>
                  <th className="px-5 py-4 text-sm font-semibold text-[#FF6B35]">AI Scan Assist</th>
                  <th className="px-5 py-4 text-sm font-semibold text-zinc-500">Manual takeoff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 text-sm font-medium text-zinc-900">Speed</td><td className="px-5 py-3 text-sm text-zinc-700">Seconds to identify all elements</td><td className="px-5 py-3 text-sm text-zinc-500">Draw each line manually</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 text-sm font-medium text-zinc-900">Accuracy</td><td className="px-5 py-3 text-sm text-zinc-700">AI suggests, you verify and adjust</td><td className="px-5 py-3 text-sm text-zinc-500">You draw exactly what you see</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 text-sm font-medium text-zinc-900">Component swapping</td><td className="px-5 py-3 text-sm text-zinc-700">Swap any placeholder via dropdown</td><td className="px-5 py-3 text-sm text-zinc-500">Assign components as you draw</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 text-sm font-medium text-zinc-900">Adding non-detected items</td><td className="px-5 py-3 text-sm text-zinc-700">Add flashings, downpipes, etc after AI runs</td><td className="px-5 py-3 text-sm text-zinc-500">Draw and assign everything yourself</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 text-sm font-medium text-zinc-900">Cost</td><td className="px-5 py-3 text-sm text-zinc-700">Uses AI scan points (20 trial, 50-100 paid)</td><td className="px-5 py-3 text-sm text-zinc-500">No scan points used</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 text-sm font-medium text-zinc-900">Result</td><td className="px-5 py-3 text-sm text-zinc-700">Complete, priced roof takeoff</td><td className="px-5 py-3 text-sm text-zinc-500">Complete, priced roof takeoff</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Related features */}
        <section className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">Related features</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Link href="/features/digital-roof-takeoff" className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all">
              <h3 className="text-base font-semibold text-zinc-950">Digital Roof Takeoff</h3>
              <p className="mt-2 text-sm text-zinc-600">Manual takeoff tools, pitch calculation, Smart Component integration.</p>
            </Link>
            <Link href="/features/smart-components" className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all">
              <h3 className="text-base font-semibold text-zinc-950">Smart Components</h3>
              <p className="mt-2 text-sm text-zinc-600">Reusable pricing, labour, waste and measurement rules for every roof component.</p>
            </Link>
            <Link href="/features/sending-and-tracking" className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all">
              <h3 className="text-base font-semibold text-zinc-950">Sending &amp; Tracking</h3>
              <p className="mt-2 text-sm text-zinc-600">Send quotes, orders and invoices. Track opens, reads and status. Automate follow-ups.</p>
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">FAQ</h2>
          <div className="mt-6 space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-5">
                <p className="text-base font-semibold text-zinc-950">{faq.q}</p>
                <p className="mt-3 text-base leading-7 text-zinc-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-white py-16 sm:py-20">
          <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">Try AI Scan Assist free for 14 days</h2>
            <p className="mt-4 text-base text-zinc-600">20 AI scan points included. No card required.</p>
            <a href="/free-trial" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]">
              Start free trial
            </a>
            <Link href="/takeoff-demo" className="ml-3 mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-7 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-[#FF6B35] hover:bg-orange-50">
              Try the takeoff demo
            </Link>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
