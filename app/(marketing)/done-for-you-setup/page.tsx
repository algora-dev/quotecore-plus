import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Done-For-You Setup - We Build It For You | QuoteCore+",
  description:
    "Tell us how you currently price and work, and we'll build it into QuoteCore+ for you — including setup, training, ongoing support and other benefits.",
  alternates: {
    canonical: "https://quote-core.com/done-for-you-setup",
  },
};

export default function DoneForYouSetupPage() {
  return (
    <>
      <BlogHeader />
      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Done-For-You Setup
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
          Tell us how you&rsquo;re currently pricing and working now, and we&rsquo;ll
          build it into QuoteCore+ for you — including setup, training, ongoing
          support and other benefits.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/contact"
            className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Book a call
          </Link>
          <Link
            href="/free-trial"
            className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:border-slate-400 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Start free trial
          </Link>
        </div>
        <p className="mt-6 text-xs italic text-slate-400">
          Let&rsquo;s first see if QuoteCore+ actually suits your workflow.
        </p>
        <p className="mt-16 text-sm text-slate-400">
          Full details coming soon. This page is a placeholder.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
