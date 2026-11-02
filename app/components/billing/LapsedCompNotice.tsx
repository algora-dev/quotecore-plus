import Link from 'next/link';
import { workflowCallHref } from '@/lib/booking';

/**
 * Lapsed complimentary-access notice.
 *
 * This is a billing recovery surface for legacy complimentary grants. It must
 * not reintroduce the old free-trial/demo/public-pricing-builder funnel.
 * Saved data remains intact; the billing surface below handles paid access.
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
        Your complimentary paid access{endedLabel ? ` ended on ${endedLabel}` : ' has ended'}.
        Your account, jobs and quotes are still saved. Use the billing options below to choose
        the paid features and capacity you need, or talk it through with Shaun first.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={workflowCallHref}
          prefetch={false}
          className="qc-button"
          data-qc-variant="primary"
        >
          Book 25 minutes with Shaun
        </Link>
      </div>
    </section>
  );
}
