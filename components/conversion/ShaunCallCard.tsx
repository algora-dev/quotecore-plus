import { MarketingButton } from "@/components/marketing/MarketingButton";
import { workflowCallHref } from "@/lib/booking";
import { shaunCallLabelShort, shaunCallPromiseShort } from "@/lib/marketing-conversion";

/**
 * Shared assisted-conversion treatment.
 * Keeps the value of the call attached to the CTA wherever it appears.
 */
export default function ShaunCallCard({
  location = "marketing",
  compact = false,
  className = "",
}: {
  location?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <aside
      className={`rounded-2xl border border-[#FF6B35]/25 bg-[linear-gradient(135deg,#FFF8F2_0%,#FFFFFF_72%)] p-5 text-left shadow-[0_12px_34px_rgba(25,27,32,0.06)] ${className}`.trim()}
      data-analytics-location={location}
      data-analytics-surface="shaun_call_card"
    >
      <div className={compact ? "flex flex-col gap-4" : "flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"}>
        <div className="flex min-w-0 items-start gap-3">
          <img
            src="/shaun-smiling.jpg"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 shrink-0 rounded-full border border-[#FF6B35]/20 object-cover"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#B63D0A]">25 minutes with Shaun</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-700">{shaunCallPromiseShort}</p>
          </div>
        </div>
        <MarketingButton href={workflowCallHref} variant="primary" size={compact ? "default" : "large"} className="w-full shrink-0 sm:w-auto">
          {shaunCallLabelShort}
        </MarketingButton>
      </div>
    </aside>
  );
}
