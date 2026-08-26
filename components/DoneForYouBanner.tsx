import Link from 'next/link';

/**
 * Narrow full-width reassurance CTA shown directly under the hero video.
 * Removes the "another piece of software to set up" objection.
 */
export default function DoneForYouBanner() {
  return (
    <section className="w-full border-y border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 text-center md:py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:text-left">
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            &ldquo;Oh great&hellip; another piece of software I have to set up.&rdquo;{' '}
            <span className="text-[#BD4A1A]">You don&rsquo;t.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">
            Tell us how you&rsquo;re currently pricing and working now, and we&rsquo;ll
            build it into QuoteCore+ for you — including setup, training, ongoing
            support and other benefits.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 lg:items-end">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/done-for-you-setup"
              className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              See how it works
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:border-slate-400 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Book a call
            </Link>
          </div>
          <p className="text-xs italic text-slate-400">
            Let&rsquo;s first see if QuoteCore+ actually suits your workflow.
          </p>
        </div>
      </div>
    </section>
  );
}
