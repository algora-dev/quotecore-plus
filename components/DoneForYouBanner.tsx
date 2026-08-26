import Link from 'next/link';

/**
 * Narrow full-width reassurance CTA shown directly under the hero video.
 * Removes the "another piece of software to set up" objection.
 */
export default function DoneForYouBanner() {
  return (
    <section className="w-full border-y border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-14 text-center md:py-16 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:py-20 lg:text-left">
        <div className="max-w-xl lg:max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            &ldquo;Oh great&hellip; another piece of software I have to set
            up.&rdquo;{' '}
            <span className="ml-1 whitespace-nowrap text-[#FF6B35]">
              You don&rsquo;t.
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Tell us how you&rsquo;re pricing and working now, and we&rsquo;ll
            rebuild it inside QuoteCore+ for you — setup, training and ongoing
            support included.
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
              Book a 15-minute call
            </Link>
          </div>
          <p className="text-xs italic text-slate-400">
            First, let&rsquo;s see if QuoteCore+ actually fits your workflow.
          </p>
        </div>
      </div>
    </section>
  );
}
