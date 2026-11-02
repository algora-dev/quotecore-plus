import { FreeWorkspaceButton } from "@/components/marketing/FreeWorkspaceButton";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { workflowCallHref } from "@/lib/booking";
import { freeWorkspaceLabel, shaunCallLabelShort, shaunCallPromiseShort } from "@/lib/marketing-conversion";
import ShaunCallCard from "@/components/conversion/ShaunCallCard";

/** Reusable two-path acquisition block for marketing pages. */
export default function TwoPathCta({
  location = "marketing",
  className = "",
  compact = false,
  title,
  description,
}: {
  location?: string;
  className?: string;
  compact?: boolean;
  title?: string;
  description?: string;
}) {
  if (compact) {
    return (
      <div className={className} data-analytics-location={location} data-analytics-surface="two_path_cta_compact">
        {title ? <h3 className="text-xl font-[650] tracking-[-0.025em] text-zinc-950 sm:text-2xl">{title}</h3> : null}
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-[15px] sm:leading-7">{description}</p> : null}
        <aside className={`${title || description ? "mt-5" : ""} max-w-3xl rounded-2xl border border-[#FF6B35]/25 bg-[linear-gradient(135deg,#FFF8F2_0%,#FFFFFF_72%)] p-4 text-left shadow-[0_10px_28px_rgba(25,27,32,0.05)]`}>
          <div className="flex items-start gap-3">
            <img
              src="/shaun-smiling.jpg"
              alt=""
              aria-hidden="true"
              className="h-11 w-11 shrink-0 rounded-full border border-[#FF6B35]/20 object-cover"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#B63D0A]">25 minutes with Shaun</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{shaunCallPromiseShort}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <MarketingButton href={workflowCallHref} variant="primary" size="large">{shaunCallLabelShort}</MarketingButton>
            <FreeWorkspaceButton variant="glass" size="large">{freeWorkspaceLabel}</FreeWorkspaceButton>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className={className} data-analytics-location={location} data-analytics-surface="two_path_cta">
      {title ? <h3 className="text-xl font-[650] tracking-[-0.025em] text-zinc-950 sm:text-2xl">{title}</h3> : null}
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-[15px] sm:leading-7">{description}</p> : null}
      <div className={`${title || description ? "mt-5" : ""} grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(250px,.65fr)]`}>
        <ShaunCallCard location={`${location}_call`} />
        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-[0_10px_28px_rgba(25,27,32,0.04)]">
          <p className="text-sm font-[650] text-zinc-950">Prefer to explore yourself?</p>
          <p className="mt-1 text-sm leading-6 text-zinc-600">Create a real Free Workspace with no card and no expiry. Use your own jobs, with the optional Guided Walkthrough there when you want it.</p>
          <div className="mt-4">
            <FreeWorkspaceButton variant="glass" size="large" className="w-full">{freeWorkspaceLabel}</FreeWorkspaceButton>
          </div>
        </aside>
      </div>
    </div>
  );
}
