import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import YouTubeLite from "@/components/YouTubeLite";
import { siteUrl } from "@/lib/schema";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Tutorials & Videos | QuoteCore+",
  description:
    "Watch step-by-step QuoteCore+ tutorials. Learn how to create Smart Components, build quotes, order materials, invoice clients, and get the most out of the platform.",
  alternates: {
    canonical: "https://quote-core.com/tutorials",
    languages: hreflangLanguages("/tutorials"),
  },
  openGraph: {
    title: "Tutorials & Videos | QuoteCore+",
    description:
      "Watch step-by-step QuoteCore+ tutorials. Learn how to create Smart Components, build quotes, order materials, invoice clients, and get the most out of the platform.",
    url: "https://quote-core.com/tutorials",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const tutorials = [
  {
    videoId: "DziFjqnPdqQ",
    title: "Create a complex roofing quote in under 3 minutes",
    description:
      "See how QuoteCore+ lets you build a complete roofing quote from a plan in under 3 minutes using preconfigured Smart Components and digital takeoff.",
    category: "Getting Started",
  },
  {
    videoId: "rqmEtartkYw",
    title: "Still looking for the long wait?",
    description:
      "The story behind QuoteCore+ and why it was built - from frustrated roofer to a platform that changes how trades quote and manage jobs.",
    category: "Story",
  },
  {
    videoId: "aFXJwOiliPI",
    title: "What are Smart Components?",
    description:
      "Discover how Smart Components capture your pricing, labour, waste, formulas, and business rules so you build the logic once and reuse it on every future quote.",
    category: "Smart Components",
  },
  {
    videoId: "XZSTIfGUHAU",
    title: "How to set up roofing Smart Components",
    description:
      "Step-by-step tutorial showing how to create and configure roofing Smart Components in QuoteCore+.",
    category: "Smart Components",
  },
  {
    videoId: "kOkQuUy8MWQ",
    title: "How to order materials from an accepted quote",
    description:
      "Learn how to turn an accepted quote into a material order, edit quantities, and send it straight to your supplier.",
    category: "Orders & Invoicing",
  },
  {
    videoId: "pqIfx-rOcmo",
    title: "Create a quote from start to finish",
    description:
      "Full walkthrough showing how to create a quote from start to finish using QuoteCore+.",
    category: "Getting Started",
  },
  {
    videoId: "QyYa1VbQkbQ",
    title: "Roofing quoting software that actually works",
    description:
      "Overview of QuoteCore+ as a complete roofing quoting platform - from measurement to invoice.",
    category: "Overview",
  },
  {
    videoId: "ntyS1giH5p0",
    title: "A better way to measure, quote and invoice",
    description:
      "See the full connected workflow: measure, quote, approve, order, complete, and invoice - all in one platform.",
    category: "Overview",
  },
  {
    videoId: "1MOvQX-Lf_c",
    title: "Roofing component quote tutorial",
    description:
      "Detailed tutorial on quoting roofing components using Smart Components in QuoteCore+.",
    category: "Smart Components",
  },
];

const categories = Array.from(new Set(tutorials.map((t) => t.category)));

function TutorialCard({ tutorial }: { tutorial: (typeof tutorials)[0] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FF6B35]/35 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)]">
      <YouTubeLite
        videoId={tutorial.videoId}
        title={tutorial.title}
        className="w-full"
      />
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <span className="mb-2 inline-flex w-fit items-center rounded-full bg-[#FF6B35]/10 px-2.5 py-1 text-xs font-medium text-[#BD4A1A]">
          {tutorial.category}
        </span>
        <h3 className="text-base font-semibold leading-snug text-zinc-950">
          {tutorial.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {tutorial.description}
        </p>
      </div>
    </div>
  );
}

export default function TutorialsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "QuoteCore+ Video Tutorials",
    itemListElement: tutorials.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "VideoObject",
        name: t.title,
        description: t.description,
        thumbnailUrl: `https://i.ytimg.com/vi/${t.videoId}/maxresdefault.jpg`,
        uploadDate: "2026-07-28",
        embedUrl: `https://www.youtube-nocookie.com/embed/${t.videoId}`,
        contentUrl: `https://www.youtube.com/watch?v=${t.videoId}`,
      },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Tutorials", item: `${siteUrl}/tutorials` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        <section className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
              Tutorials & Videos
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
              Watch QuoteCore+ in action
            </h1>
            <p className="mt-5 text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
              Step-by-step tutorials covering Smart Components, quoting, material ordering, invoicing, and more. Learn at your own pace and get the most out of QuoteCore+.
            </p>
          </div>

          {categories.map((category) => {
            const categoryTutorials = tutorials.filter((t) => t.category === category);
            return (
              <div key={category} className="mt-14">
                <h2 className="mb-6 text-2xl font-semibold text-zinc-950">
                  {category}
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryTutorials.map((tutorial) => (
                    <TutorialCard key={tutorial.videoId} tutorial={tutorial} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Help resources */}
          <div className="mt-20 rounded-[2rem] border border-zinc-200 bg-zinc-50 p-8 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">
                  Need more help?
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  QuoteCore+ includes built-in documentation and an AI assistant to guide you through every feature.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  In-app resources
                </h4>
                <a
                  href="https://app.quote-core.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#BD4A1A] hover:underline"
                >
                  Documentation
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M11 3h6v6M17 3l-7 7M14 11v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <p className="text-sm leading-6 text-zinc-600">
                  Full documentation covering every feature, setting, and workflow in QuoteCore+.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Q - Your AI assistant
                </h4>
                <p className="text-sm leading-6 text-zinc-600">
                  Inside the app, Q provides guided "show me how" flows for common tasks like creating your first quote, setting up Smart Components, and sending orders. Just ask Q what you need help with.
                </p>
              </div>
            </div>
          </div>

          {/* YouTube channel CTA */}
          <div className="mt-10 text-center">
            <a
              href="https://www.youtube.com/@quotecoreplus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-3 rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
            >
              Subscribe on YouTube
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>

          {/* Explore features */}
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a href="/features" className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-slate-900">Explore features</p>
              <p className="mt-1 text-sm text-slate-500">Digital takeoff, AI Scan Assist, Smart Components, sending and tracking, and more.</p>
            </a>
            <a href="/free-trial" className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-slate-900">Start free trial</p>
              <p className="mt-1 text-sm text-slate-500">14 days, no card. Full access to every feature.</p>
            </a>
            <a href="/free-tools" className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-slate-900">Free tools</p>
              <p className="mt-1 text-sm text-slate-500">Roofing calculators, takeoff builder, and document generators.</p>
            </a>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
