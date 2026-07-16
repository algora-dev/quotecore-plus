"use client";

import { useState } from "react";
import EarlyAccessPopup from "@/components/EarlyAccessPopup";
import { trackEvent } from "@/lib/analytics";
// EarlyAccessPopup handles attribution submission via /api/leads

export default function FreeTrialClient() {
  const [showEarlyAccess, setShowEarlyAccess] = useState(false);

  return (
    <>
      <div id="trial-form" className="mt-9 rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-7">
        <div className="flex gap-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/10">
            <img src="/free-trial-icon.png" alt="" className="h-9 w-9 object-contain" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Start your free trial</h2>
            <p className="mt-3 text-base leading-7 text-zinc-600">
              No credit card required. 14-day access. Your account pauses unless you choose a plan.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { trackEvent("create_account_click"); setShowEarlyAccess(true); }}
          className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#FF6B35] px-5 py-4 text-base font-semibold text-white shadow-[0_18px_45px_rgba(255,107,53,0.24)] transition-colors hover:bg-[#E55A28]"
        >
          Create my free account
        </button>
      </div>
      {showEarlyAccess && <EarlyAccessPopup forceOpen onClose={() => setShowEarlyAccess(false)} />}
    </>
  );
}
