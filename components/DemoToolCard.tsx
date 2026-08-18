"use client";

import { trackEvent } from "@/lib/analytics";

/**
 * Interactive demo entry card — sits in the hero next to the copy.
 * Deep-links into the takeoff demo with the mode pre-selected
 * (?mode=ai | ?mode=manual — handled by DemoTakeoff).
 */
export default function DemoToolCard() {
  const go = (mode: "ai" | "manual") => {
    trackEvent("demo_tool_click", { location: "homepage_hero", mode: mode === "ai" ? "ai_scan" : "manual" });
  };

  return (
    <div className="group relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.10)]">
      <div className="relative aspect-video w-full overflow-hidden bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/takeoff-demo/roofplan-baseline.png"
          alt="Roof plan used in the QuoteCore+ interactive takeoff demo"
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          loading="eager"
          width={1280}
          height={720}
        />
        {/* Gradient overlay for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />

        {/* Corner badge */}
        <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-[#FF6B35] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Interactive demo
        </span>

        {/* Copy overlay */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:p-5">
          <p className="text-base font-semibold leading-snug text-white sm:text-lg">
            Try our real system in 30 seconds or less
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={`/takeoff-demo?mode=ai`}
              onClick={() => go("ai")}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#FF6B35] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
            >
              Try AI Scan Assist
            </a>
            <a
              href={`/takeoff-demo?mode=manual`}
              onClick={() => go("manual")}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/60 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-zinc-950"
            >
              Try Manual Digital Measure
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
