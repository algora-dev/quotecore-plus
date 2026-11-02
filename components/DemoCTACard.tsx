"use client";

import { FreeWorkspaceButton } from "@/components/marketing/FreeWorkspaceButton";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { workflowCallHref } from "@/lib/booking";
import { freeWorkspaceLabel, shaunCallLabelShort, shaunCallPromiseShort } from "@/lib/marketing-conversion";

/**
 * Historical name retained for import compatibility. This is now the shared
 * Free Workspace acquisition card. The focused public takeoff demo still
 * exists, but is no longer used as the main product-acquisition CTA.
 */
export default function DemoCTACard({
  location,
  variant = "hero",
  className = "",
}: {
  location: string;
  variant?: "hero" | "inline";
  primaryMode?: "ai" | "manual";
  className?: string;
}) {
  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <MarketingButton href={workflowCallHref} variant="primary" size="large" className="flex-1">{shaunCallLabelShort}</MarketingButton>
      <FreeWorkspaceButton variant="glass" size="large" className="flex-1">{freeWorkspaceLabel}</FreeWorkspaceButton>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)] ${className}`} data-analytics-location={location}>
        <div className="p-5 sm:p-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B63D0A]">25 minutes with Shaun</span>
          <p className="mt-2 text-lg font-semibold leading-snug text-zinc-950">Tell Shaun how you work. Find the fastest useful next step.</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Prefer to explore first? Create a real Free Workspace with no card or expiry and see what fits your business.</p>
          <div className="mt-4">{actions}</div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">{shaunCallPromiseShort}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-[radial-gradient(circle_at_top_right,rgba(255,107,53,.13),transparent_38%),#fff] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.10)] sm:p-8 ${className}`} data-analytics-location={location}>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B63D0A]">25 minutes with Shaun</span>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">Tell Shaun how you work. See what would actually make it faster.</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-600 sm:text-base">Prefer to explore yourself? Create a real Free Workspace with no card or expiry and see what fits your business.</p>
      <div className="mt-6">{actions}</div>
      <p className="mt-4 text-xs leading-5 text-zinc-500">{shaunCallPromiseShort}</p>
    </div>
  );
}
