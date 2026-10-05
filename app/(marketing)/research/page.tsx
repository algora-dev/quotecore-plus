import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import LazyYouTube from "@/components/LazyYouTube";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPageMetadata } from "@/app/lib/seo";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

const RESEARCH_PATH = "/research";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "QuoteCore+ Original Research",
    description:
      "Original field studies and research from QuoteCore+. Remote roof measurement accuracy tested on 10 real roofs, with full methodology and downloadable datasets.",
    path: RESEARCH_PATH,
  }),
  alternates: { canonical: `${SITE_URL}${RESEARCH_PATH}`, languages: hreflangLanguages(RESEARCH_PATH) },
};

export default function ResearchIndexPage() {
  return (
    <>
      <BlogHeader />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Research" }]} />
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 lg:px-8">
        <p className="text-sm font-medium text-[#FF6B35]">Original research</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">QuoteCore+ field studies</h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-600">
          We test our own tools against reality and publish everything - methodology, raw data and known failures.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/research/google-earth-roof-measurement-accuracy"
            className="rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-[#FF6B35]/40 hover:bg-orange-50/40"
          >
            <p className="text-xs font-semibold text-[#BD4A1A]">Field study · 10 roofs</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">How Accurate Is Measuring a Roof With Google Earth?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              We remotely measured 10 real roofs using free aerial imagery and QuoteCore+, then physically verified every measurement on site. 3.52% average area error, 136 component comparisons, full dataset published.
            </p>
          </Link>
        </div>
        <div className="mt-10">
          <p className="text-sm font-semibold text-slate-900">Watch the study</p>
          <p className="mt-1 text-sm text-zinc-600">The full 10-roof test on video - every remote measurement compared against the physical roof.</p>
          <div className="mt-4 max-w-2xl">
            <LazyYouTube
              videoId="k-5FTjyK1wg"
              title="How Accurate Is Measuring a Roof with Google Earth? We Tested 10 Real Roofs!"
            />
          </div>
          <p className="mt-4 text-sm text-zinc-600">More videos on the <a href="https://www.youtube.com/@quotecoreplus" target="_blank" rel="noopener noreferrer" className="font-medium text-[#FF6B35] underline underline-offset-4">QuoteCore+ YouTube channel</a>.</p>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
