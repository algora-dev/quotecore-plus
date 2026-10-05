"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Free Roof Takeoff entry card — Tier 2 of the two-tier funnel.
 * Collapsed by default (attractive teaser row); expands to reveal the
 * full plan-image card with the "Upload Your Own Plan" CTA.
 */
export default function FreeTakeoffCTACard({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`group relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.10)] ${className}`}
    >
      {/* Collapsed teaser row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="free-takeoff-card-content"
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-orange-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 sm:px-6 sm:py-5"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-[#FF6B35] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Free tool · No sign-in
          </span>
          <span className="text-sm font-semibold text-zinc-950 sm:text-base">
            {open ? "Hide your own roof plan" : "Try it with your own roof plan here"}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 flex-shrink-0 text-[#FF6B35] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expandable content */}
      <div
        id="free-takeoff-card-content"
        hidden={!open}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/free-tools/FreeRoofTakeOffTool2.png"
            alt="Measure your own roof plan with the QuoteCore+ free roof takeoff tool"
            className="h-full w-full object-contain"
            loading="lazy"
            width={1280}
            height={720}
          />
          {/* Gradient overlay for legibility */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />

          {/* Copy overlay */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:p-5">
            <p className="text-base font-semibold leading-snug text-white sm:text-lg">
              Measure your own roof plan — free, no signup
            </p>
            <p className="hidden text-sm leading-6 text-zinc-200 sm:block">
              Upload a real plan and test the takeoff workflow on your own job - no account needed.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/free-roof-takeoff"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#FF6B35] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
              >
                Upload Your Own Plan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
