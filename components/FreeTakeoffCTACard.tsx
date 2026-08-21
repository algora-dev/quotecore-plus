import Link from "next/link";

/**
 * Free Roof Takeoff entry card — Tier 2 of the two-tier funnel.
 * Mirrors the DemoCTACard hero styling: plan image, badge, copy, CTA.
 * "Upload your own plan" / "Test it on your own job" framing.
 */
export default function FreeTakeoffCTACard({ className = "" }: { className?: string }) {
  return (
    <div className={`group relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.10)] ${className}`}>
      <div className="relative aspect-video w-full overflow-hidden bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/free-tools/FreeRoofTakeOffTool2.png"
          alt="Measure your own roof plan with the QuoteCore+ free roof takeoff tool"
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          loading="eager"
          width={1280}
          height={720}
        />
        {/* Gradient overlay for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />

        {/* Corner badge */}
        <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-[#FF6B35] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Free tool · No sign-in
        </span>

        {/* Copy overlay */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:p-5">
          <p className="text-base font-semibold leading-snug text-white sm:text-lg">
            Test it on your own job — 30 seconds to start
          </p>
          <p className="hidden text-sm leading-6 text-zinc-200 sm:block">
            Upload your own roof plan and measure it with pitch calculations — the full takeoff tool, free and no sign-in.
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
  );
}
