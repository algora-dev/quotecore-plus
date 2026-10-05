"use client";

import { trackEvent } from "@/lib/analytics";

/**
 * Get started page CTA — free tools (no signup) + choose a plan.
 */
export default function FreeTrialClient() {
  return (
    <div id="trial-form" className="mt-9 rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-7">
      <div className="flex gap-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/10">
          <img src="/free-trial-icon.png" alt="" className="h-9 w-9 object-contain" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Two ways to start</h2>
          <p className="mt-3 text-base leading-7 text-zinc-600">
            Use the free tools instantly with no signup, or choose a paid plan from $19/month - backed by a 30-day money-back guarantee.
          </p>
        </div>
      </div>
      <a
        href="/pricing"
        onClick={() => trackEvent("get_started_click", { location: "get-started-page", target: "pricing" })}
        className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#FF6B35] px-5 py-4 text-base font-semibold text-white shadow-[0_18px_45px_rgba(255,107,53,0.24)] transition-colors hover:bg-[#E55A28]"
      >
        Choose your plan
      </a>
      <a
        href="/free-tools"
        onClick={() => trackEvent("free_tools_click", { location: "get-started-page" })}
        className="mt-3 inline-flex w-full items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white px-5 py-4 text-base font-semibold text-zinc-900 transition-colors hover:border-[#FF6B35]/40"
      >
        Browse the free tools - no signup
      </a>
    </div>
  );
}
