"use client";

import { trackEvent } from "@/lib/analytics";

/**
 * Shared demo entry card. Deep-links into /takeoff-demo with the mode
 * pre-selected (?mode=ai | ?mode=manual — handled by DemoTakeoff).
 *
 * variant="hero"   — full-width aspect-video card (homepage hero)
 * variant="inline" — compact horizontal card (blogs, calculators, CTA areas)
 *
 * primaryMode lets a placement emphasise one button (e.g. AI on the
 * AI Scan Assist feature page) — the other stays as secondary.
 */
export default function DemoCTACard({
  location,
  variant = "hero",
  primaryMode,
  className = "",
}: {
  location: string;
  variant?: "hero" | "inline";
  primaryMode?: "ai" | "manual";
  className?: string;
}) {
  const go = (mode: "ai" | "manual") => {
    trackEvent("demo_tool_click", { location, mode: mode === "ai" ? "ai_scan" : "manual" });
  };

  const Buttons = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row"}`}>
      <a
        href="/takeoff-demo?mode=ai"
        onClick={() => go("ai")}
        className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
          primaryMode === "manual"
            ? "border border-white/60 bg-white/10 text-white backdrop-blur-sm hover:bg-white hover:text-zinc-950"
            : "bg-[#FF6B35] text-white hover:bg-[#E55A28]"
        }`}
      >
        Try AI Scan Assist
      </a>
      <a
        href="/takeoff-demo?mode=manual"
        onClick={() => go("manual")}
        className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
          primaryMode === "ai"
            ? "border border-white/60 bg-white/10 text-white backdrop-blur-sm hover:bg-white hover:text-zinc-950"
            : "bg-[#FF6B35] text-white hover:bg-[#E55A28]"
        }`}
      >
        Try Manual Digital Measure
      </a>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={`group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)] ${className}`}>
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-36 w-full shrink-0 overflow-hidden bg-white sm:h-auto sm:w-52">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/takeoff-demo/roofplan-baseline.png"
              alt="Roof plan used in the QuoteCore+ interactive takeoff demo"
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              width={1280}
              height={720}
            />
            <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-[#FF6B35] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Interactive demo
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-5">
            <p className="text-base font-semibold leading-snug text-zinc-950">
              Try our real system in 30 seconds or less
            </p>
            <p className="text-sm leading-6 text-zinc-600">
              The same takeoff workstation that&apos;s in the app. No sign-in needed.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href="/takeoff-demo?mode=ai"
                onClick={() => go("ai")}
                className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                  primaryMode === "manual"
                    ? "border border-zinc-300 text-zinc-900 hover:border-[#FF6B35]/40 hover:bg-orange-50"
                    : "bg-[#FF6B35] text-white hover:bg-[#E55A28]"
                }`}
              >
                Try AI Scan Assist
              </a>
              <a
                href="/takeoff-demo?mode=manual"
                onClick={() => go("manual")}
                className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                  primaryMode === "ai"
                    ? "border border-zinc-300 text-zinc-900 hover:border-[#FF6B35]/40 hover:bg-orange-50"
                    : "bg-[#FF6B35] text-white hover:bg-[#E55A28]"
                }`}
              >
                Try Manual Measure
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.10)] ${className}`}>
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
          <p className="hidden text-sm leading-6 text-zinc-200 sm:block">
            Scan this sample roof plan with AI or measure it yourself - the same takeoff workstation that&apos;s in the app. No sign-in needed.
          </p>
          <Buttons />
        </div>
      </div>
    </div>
  );
}
