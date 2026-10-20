import Link from 'next/link';

/**
 * Lapsed-comp notice (owner directive 2026-10-18).
 *
 * Shown at the top of the onboarding paywall when the company had a
 * complimentary access grant (companies.comp_until) that has since passed
 * and the account is inactive. The 2026-09-16 one-month comps expired
 * 2026-10-16; instead of a silent paywall, these users get a plain
 * explanation plus the three routes the owner chose:
 *   1. Build a paid plan (pricing builder)
 *   2. Explore the interactive demo (which replaced the free trial)
 *   3. See what's new (marketing homepage)
 *
 * Purely presentational; the paywall below still handles actual checkout.
 */
export function LapsedCompNotice({ endedOn }: { endedOn: string | null }) {
  const endedLabel = endedOn
    ? new Date(endedOn).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <section
      aria-label="Your free access has ended"
      className="mx-auto max-w-2xl rounded-xl border border-orange-200 bg-orange-50/40 px-6 py-6"
    >
      <h2 className="text-base font-bold text-slate-900">
        Your complimentary access has ended
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Your free access to QuoteCore+{endedLabel ? ` ended on ${endedLabel}` : ' has ended'},
        and QuoteCore+ no longer offers a free trial. Your account, jobs and quotes are all
        still saved — choose an option below to keep going.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/pricing"
          prefetch={false}
          className="qc-button"
          data-qc-variant="primary"
        >
          Create your paid plan
        </Link>
        <Link
          href="/demo"
          prefetch={false}
          className="qc-button"
          data-qc-variant="glass"
        >
          Explore the demo
        </Link>
        <Link
          href="https://quote-core.com"
          prefetch={false}
          className="text-sm font-medium text-[#BD4A1A] hover:text-[#ff5722]"
        >
          See what&apos;s new &rarr;
        </Link>
      </div>
    </section>
  );
}
